<?php

namespace App\Notifications;

use App\Services\NotificationContentService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Digest des messages de chat : UNE notification récapitulative par fenêtre
 * (réglage admin chat_digest_hours) au lieu d'un mail par message.
 *
 * Le `type` = 'messages' est LA CLÉ DE FILTRAGE de la boîte de réception
 * (même convention que BookOrderedNotification) ; `kind` = 'chat_digest'
 * sert d'anti-doublon à la commande SendChatDigests.
 */
class ChatDigestNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * Canaux Laravel actifs (database, mail). Telegram est envoyé
     * séparément par la commande (chat_id par utilisateur, même pattern
     * que ProcessBookOrderNotifications).
     *
     * @var array<int, string>
     */
    public array $channels;

    public function __construct(
        public int $messagesCount,
        public int $threadsCount,
        array $channels,
    ) {
        $this->channels = $channels;
    }

    public function via(object $notifiable): array
    {
        return $this->channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $content = app(NotificationContentService::class)
            ->build('messages', $this->toArray($notifiable), 'mail');

        return (new MailMessage)
            ->subject($content['subject'])
            ->view('mails.notifications.mail', [
                'title' => $content['title'],
                'lines' => $content['lines'],
                'cta_label' => $content['cta_label'],
                'url' => $content['url'],
            ]);
    }

    /**
     * Canal database / in-app : convention de la boîte de réception.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'messages',
            'kind' => 'chat_digest',
            'title' => 'Nouveaux messages',
            'message' => "Vous avez {$this->messagesCount} nouveau(x) message(s) dans {$this->threadsCount} conversation(s).",
            'url' => '/dashboard/messages',
        ];
    }
}
