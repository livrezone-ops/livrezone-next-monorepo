<?php

namespace App\Events;

use App\Models\ChatMessage;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public ChatMessage $message;

    /**
     * Create a new event instance.
     */
    public function __construct(ChatMessage $message)
    {
        $this->message = $message;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('chat.thread.' . $this->message->chat_thread_id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'message.sent';
    }

    /**
     * Data diffusée au client (l'émetteur est exclu via ->toOthers()).
     */
    public function broadcastWith(): array
    {
        $this->message->load('sender.profile');

        return [
            'id' => $this->message->id,
            'chat_thread_id' => $this->message->chat_thread_id,
            'sender_id' => $this->message->sender_id,
            'sender_nickname' => $this->message->sender?->profile?->nickname
                ?? 'utilisateur-' . $this->message->sender_id,
            'message' => $this->message->message,
            'is_read' => $this->message->is_read,
            'created_at' => $this->message->created_at?->toISOString(),
        ];
    }
}