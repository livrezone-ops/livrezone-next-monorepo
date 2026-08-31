<?php

namespace App\Console\Commands;

use App\Models\ChatMessage;
use App\Models\ChatThread;
use App\Models\User;
use App\Notifications\ChatDigestNotification;
use App\Services\NotificationContentService;
use App\Services\SubscriptionService;
use App\Services\TelegramNotificationService;
use App\Support\NotificationChannels;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Digest des messages de chat (T3) : au lieu d'une notification par message,
 * UNE notification récapitulative par fenêtre de X heures (réglage admin
 * chat_digest_hours). Planifiée horaire (routes/console.php) ; la granularité
 * fine est portée par la fenêtre.
 *
 * Anti-doublon : un message déjà couvert par un digest précédent n'est pas
 * re-notifié (created_at > dernier digest 'messages' kind 'chat_digest').
 */
class SendChatDigests extends Command
{
    protected $signature = 'notifications:send-chat-digest';

    protected $description = 'Envoie le résumé périodique des nouveaux messages de chat (une notification par fenêtre)';

    public function handle(
        SubscriptionService $subscriptions,
        TelegramNotificationService $telegram,
    ): int {
        $windowHours = $subscriptions->getChatDigestHours();
        $windowStart = now()->subHours($windowHours);

        // Destinataires ayant au moins un message non lu dans la fenêtre,
        // en excluant l'expéditeur. Un thread lie user_one_id/user_two_id :
        // le destinataire est l'autre participant.
        $recipientSql = 'CASE WHEN m.sender_id = t.user_one_id THEN t.user_two_id ELSE t.user_one_id END';
        $recipients = DB::table('chat_messages as m')
            ->join('chat_threads as t', 't.id', '=', 'm.chat_thread_id')
            ->join('users as u', 'u.id', '=', DB::raw($recipientSql))
            ->join('profiles as p', 'p.user_id', '=', 'u.id')
            ->where('m.is_read', false)
            ->where('m.created_at', '>=', $windowStart)
            // thread non supprimé (soft) pour le destinataire
            ->whereRaw("(t.deleted_for_user_one_at IS NULL OR {$recipientSql} <> t.user_one_id)")
            ->whereRaw("(t.deleted_for_user_two_at IS NULL OR {$recipientSql} <> t.user_two_id)")
            ->groupBy('u.id', 'p.telegram_id')
            ->selectRaw("u.id as user_id, p.telegram_id, COUNT(*) as messages_count, COUNT(DISTINCT m.chat_thread_id) as threads_count")
            ->get();

        if ($recipients->isEmpty()) {
            $this->info("Aucun destinataire éligible (fenêtre {$windowHours} h).");

            return self::SUCCESS;
        }

        $sent = 0;
        foreach ($recipients as $row) {
            $user = User::find($row->user_id);
            if (! $user) {
                continue;
            }

            // Anti-doublon : messages déjà couverts par le dernier digest.
            $lastDigestAt = $user->notifications()
                ->where('data->type', 'messages')
                ->where('data->kind', 'chat_digest')
                ->latest()
                ->first()
                ?->created_at;
            if ($lastDigestAt) {
                $newCount = ChatMessage::where('is_read', false)
                    ->where('created_at', '>=', $windowStart)
                    ->where('created_at', '>', $lastDigestAt)
                    ->whereIn('chat_thread_id', function ($q) use ($row): void {
                        $q->select('id')->from((new ChatThread)->getTable())
                            ->where('user_one_id', $row->user_id)
                            ->orWhere('user_two_id', $row->user_id);
                    })
                    ->where('sender_id', '!=', $row->user_id)
                    ->count();
                if ($newCount === 0) {
                    continue; // tout a déjà été couvert par le digest précédent
                }
                $messagesCount = $newCount;
            } else {
                $messagesCount = (int) $row->messages_count;
            }

            // Canaux : in-app TOUJOURS (règle produit) ; mail/telegram selon
            // préférences (type 'messages') ET abonnement.
            $profile = $user->profile;
            $allowed = $subscriptions->allowedNotificationChannels($profile);
            $prefs = $user->notificationPreferences->where('notification_type', 'messages');
            $wantsEmail = $prefs->where('channel', NotificationChannels::PREF_EMAIL)->first()?->is_enabled ?? true;
            $wantsTelegram = $prefs->where('channel', NotificationChannels::PREF_TELEGRAM)->first()?->is_enabled ?? true;

            $laravelChannels = [NotificationChannels::DATABASE];
            if (in_array(NotificationChannels::MAIL, $allowed, true) && $wantsEmail) {
                $laravelChannels[] = NotificationChannels::MAIL;
            }

            $threadsCount = (int) $row->threads_count;
            $user->notify(new ChatDigestNotification($messagesCount, $threadsCount, $laravelChannels));

            if (in_array(NotificationChannels::TELEGRAM, $allowed, true) && $wantsTelegram && $row->telegram_id) {
                $telegram->sendToChat(
                    $row->telegram_id,
                    app(NotificationContentService::class)->telegramText('messages', [
                        'title' => 'Nouveaux messages',
                        'message' => "Vous avez {$messagesCount} nouveau(x) message(s) dans {$threadsCount} conversation(s).",
                        'url' => '/dashboard/messages',
                    ]),
                );
            }

            $sent++;
        }

        $this->info("Digests envoyés : {$sent} (fenêtre {$windowHours} h).");

        return self::SUCCESS;
    }
}
