<?php

namespace App\Policies;

use App\Models\ChatMessage;
use App\Models\ChatThread;
use App\Models\User;

class ChatMessagePolicy
{
    /**
     * Édition/suppression d'un message : auteur seul, et uniquement dans le fil
     * auquel le message appartient réellement.
     */
    public function update(User $user, ChatMessage $message, ChatThread $thread): bool
    {
        return $message->sender_id === $user->id && $message->chat_thread_id === $thread->id;
    }

    public function delete(User $user, ChatMessage $message, ChatThread $thread): bool
    {
        return $message->sender_id === $user->id && $message->chat_thread_id === $thread->id;
    }
}
