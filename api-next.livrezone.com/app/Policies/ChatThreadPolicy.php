<?php

namespace App\Policies;

use App\Models\ChatThread;
use App\Models\User;

class ChatThreadPolicy
{
    /**
     * Un utilisateur ne peut accéder qu'aux fils dont il est l'un des deux participants.
     * Utilisée par ChatController (participation aux endpoints) et par le canal
     * broadcast « chat.thread.{id} ».
     */
    public function participate(User $user, ChatThread $thread): bool
    {
        return $thread->user_one_id === $user->id || $thread->user_two_id === $user->id;
    }
}
