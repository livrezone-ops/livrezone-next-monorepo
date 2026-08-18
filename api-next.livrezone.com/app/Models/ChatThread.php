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
        'deleted_for_user_one_at',
        'deleted_for_user_two_at',
    ];

    protected $casts = [
        'last_message_at' => 'datetime',
        'deleted_for_user_one_at' => 'datetime',
        'deleted_for_user_two_at' => 'datetime',
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

    /**
     * Le fil est-il masqué pour cet utilisateur (suppression douce) ?
     */
    public function isDeletedFor(int $userId): bool
    {
        return $userId === $this->user_one_id
            ? $this->deleted_for_user_one_at !== null
            : $this->deleted_for_user_two_at !== null;
    }

    /**
     * Masque le fil pour un utilisateur (suppression douce).
     */
    public function markDeletedFor(int $userId): void
    {
        if ($userId === $this->user_one_id) {
            $this->update(['deleted_for_user_one_at' => now()]);
        } elseif ($userId === $this->user_two_id) {
            $this->update(['deleted_for_user_two_at' => now()]);
        }
    }

    /**
     * Réaffiche le fil pour un utilisateur.
     */
    public function resetDeletedFor(int $userId): void
    {
        if ($userId === $this->user_one_id) {
            if ($this->deleted_for_user_one_at !== null) {
                $this->update(['deleted_for_user_one_at' => null]);
            }
        } elseif ($userId === $this->user_two_id && $this->deleted_for_user_two_at !== null) {
            $this->update(['deleted_for_user_two_at' => null]);
        }
    }
}
