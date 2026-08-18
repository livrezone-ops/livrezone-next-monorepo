<?php

namespace App\Http\Controllers\Api;

use App\Events\MessageSent;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ChatMessageStoreRequest;
use App\Http\Requests\Api\ChatThreadStoreRequest;
use App\Models\ChatMessage;
use App\Models\ChatThread;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatController extends Controller
{
    /**
     * GET /api/chat/threads
     * Liste les fils de discussion de l'utilisateur connecté,
     * triés du plus récent au plus ancien, avec l'interlocuteur,
     * le dernier message et le nombre de messages non lus.
     */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $threads = ChatThread::query()
            ->with(['userOne.profile', 'userTwo.profile', 'latestMessage'])
            ->where('user_one_id', $userId)
            ->orWhere('user_two_id', $userId)
            ->orderByDesc('last_message_at')
            ->get();

        $data = $threads->map(function (ChatThread $thread) use ($userId) {
            $other = $thread->user_one_id === $userId ? $thread->userTwo : $thread->userOne;

            return [
                'id' => $thread->id,
                'other_user' => [
                    'id' => $other->id,
                    'nickname' => $other->profile?->nickname ?? 'utilisateur-' . $other->id,
                    'avatar' => $other->avatar ?? $other->profile?->logo,
                ],
                'last_message' => $thread->latestMessage ? [
                    'id' => $thread->latestMessage->id,
                    'sender_id' => $thread->latestMessage->sender_id,
                    'message' => $thread->latestMessage->message,
                    'created_at' => $thread->latestMessage->created_at?->toISOString(),
                ] : null,
                'last_message_at' => $thread->last_message_at?->toISOString(),
                'unread_count' => $thread->unreadMessagesCountFor($userId),
            ];
        });

        $totalUnread = $data->sum('unread_count');

        return response()->json([
            'data' => $data->values(),
            'total_unread' => $totalUnread,
        ]);
    }

    /**
     * POST /api/chat/threads
     * Crée (ou récupère) un fil de discussion entre l'utilisateur
     * connecté et un autre utilisateur.
     */
    public function store(ChatThreadStoreRequest $request): JsonResponse
    {
        $thread = ChatThread::getOrCreateThread(
            $request->user()->id,
            $request->integer('user_id')
        );

        return response()->json([
            'data' => [
                'id' => $thread->id,
                'created' => $thread->wasRecentlyCreated,
                'other_user' => [
                    'id' => $request->integer('user_id'),
                ],
            ],
            'message' => $thread->wasRecentlyCreated
                ? 'Fil de discussion créé.'
                : 'Fil de discussion existant.',
        ], 201);
    }

    /**
     * GET /api/chat/threads/{thread}
     * Affiche un fil avec ses messages (pagination) et l'interlocuteur.
     * Uniquement pour un participant du fil.
     */
    public function show(Request $request, ChatThread $thread): JsonResponse
    {
        if (! $this->isParticipant($thread, $request->user()->id)) {
            return response()->json(['message' => 'Accès refusé.'], 403);
        }

        $thread->load('userOne.profile', 'userTwo.profile');

        $other = $thread->user_one_id === $request->user()->id
                ? $thread->userTwo
                : $thread->userOne;

        $messages = $thread->messages()
            ->latest()
            ->paginate(50);

        return response()->json([
            'data' => [
                'id' => $thread->id,
                'other_user' => [
                    'id' => $other->id,
                    'nickname' => $other->profile?->nickname ?? 'utilisateur-' . $other->id,
                    'avatar' => $other->avatar ?? $other->profile?->logo,
                ],
                'messages' => $messages->getCollection()->reverse()->values(),
            ],
            'meta' => [
                'current_page' => $messages->currentPage(),
                'last_page' => $messages->lastPage(),
                'total' => $messages->total(),
            ],
        ]);
    }

    /**
     * POST /api/chat/threads/{thread}/messages
     * Envoie un message dans le fil et le diffuse aux autres participants.
     */
    public function sendMessage(ChatMessageStoreRequest $request, ChatThread $thread): JsonResponse
    {
        if (! $this->isParticipant($thread, $request->user()->id)) {
            return response()->json(['message' => 'Accès refusé.'], 403);
        }

        $message = ChatMessage::create([
            'chat_thread_id' => $thread->id,
            'sender_id' => $request->user()->id,
            'message' => $request->string('message')->trim()->toString(),
        ]);

        $thread->update(['last_message_at' => now()]);

        try {
            broadcast(new MessageSent($message))->toOthers();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Broadcast chat impossible', [
                'thread_id' => $thread->id,
                'message_id' => $message->id,
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json([
            'data' => $message,
            'message' => 'Message envoyé.',
        ], 201);
    }

    /**
     * POST /api/chat/threads/{thread}/read
     * Marque comme lus tous les messages reçus de l'interlocuteur.
     */
    public function markRead(Request $request, ChatThread $thread): JsonResponse
    {
        if (! $this->isParticipant($thread, $request->user()->id)) {
            return response()->json(['message' => 'Accès refusé.'], 403);
        }

        $updated = ChatMessage::query()
            ->where('chat_thread_id', $thread->id)
            ->where('sender_id', '!=', $request->user()->id)
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => now(),
            ]);

        return response()->json([
            'updated' => $updated,
            'message' => 'Messages marqués comme lus.',
        ]);
    }

    /**
     * Vérifie qu'un utilisateur participe au fil.
     */
    private function isParticipant(ChatThread $thread, int $userId): bool
    {
        return $thread->user_one_id === $userId || $thread->user_two_id === $userId;
    }
}