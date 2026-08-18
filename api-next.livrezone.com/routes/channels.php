<?php

use App\Models\ChatThread;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('chat.thread.{threadId}', function ($user, int $threadId) {
    return ChatThread::query()
        ->where('id', $threadId)
        ->where(function ($query) use ($user) {
            $query->where('user_one_id', $user->id)
                ->orWhere('user_two_id', $user->id);
        })
        ->exists();
});
