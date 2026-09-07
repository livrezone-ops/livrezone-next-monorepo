<?php

namespace App\Notifications;

use App\Models\ReferralReward;
use App\Models\ReferralRewardGrant;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/**
 * Notification in-app « palier atteint » du parrain.
 * Canal database uniquement pour l'instant (la vue /referral/me porte le
 * détail) — le mail structuré viendra via NotificationContentService si besoin.
 */
class ReferralRewardUnlocked extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public ReferralReward $reward,
        public ReferralRewardGrant $grant,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'referral_reward',
            'title' => 'Récompense de parrainage débloquée 🎁',
            'body' => "Palier « {$this->reward->name} » atteint : {$this->reward->rewardLabel()}.",
            'reward_id' => $this->reward->id,
            'grant_id' => $this->grant->id,
            'reward_type' => $this->reward->reward_type,
            'status' => $this->grant->status,
            'url' => '/referral',
        ];
    }
}
