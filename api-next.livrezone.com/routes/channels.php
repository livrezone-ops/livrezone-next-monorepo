<?php

use App\Models\ChatThread;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('chat.thread.{threadId}', function ($user, int $threadId) {
    $thread = ChatThread::query()->find($threadId);

    return $thread !== null && $user->can('participate', $thread);
});
