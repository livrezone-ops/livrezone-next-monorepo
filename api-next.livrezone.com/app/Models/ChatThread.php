<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ChatThread extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_one_id',
        'user_two_id',
        'last_message_at',
    ];

    protected $casts = [
        'last_message_at' => 'datetime',
    ];

    public function userOne()
    {
        return $this->belongsTo(User::class, 'user_one_id');
    }

    public function userTwo()
    {
        return $this->belongsTo(User::class, 'user_two_id');
    }

    public function messages()
    {
        return $this->hasMany(ChatMessage::class);
    }

    public function latestMessage()
    {
        return $this->hasOne(ChatMessage::class)->latestOfMany();
    }

    /**
     * Récupère le fil de discussion entre deux utilisateurs,
     * ou le crée s'il n'existe pas, en triant automatiquement les IDs.
     */
    public static function getOrCreateThread(int $userIdA, int $userIdB): self
    {
        $userOne = min($userIdA, $userIdB);
        $userTwo = max($userIdA, $userIdB);

        return static::firstOrCreate([
            'user_one_id' => $userOne,
            'user_two_id' => $userTwo,
        ]);
    }

    /**
     * Compte le nombre de messages non lus destinés à un utilisateur dans ce fil.
     */
    public function unreadMessagesCountFor(int $userId): int
    {
        return $this->messages()
            ->where('sender_id', '!=', $userId)
            ->where('is_read', false)
            ->count();
    }
}
