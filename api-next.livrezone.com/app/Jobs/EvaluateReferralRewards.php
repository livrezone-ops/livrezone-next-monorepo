<?php

namespace App\Jobs;

use App\Models\User;
use App\Services\Referral\ReferralRewardService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

/**
 * Évaluation des paliers de parrainage après validation d'une inscription.
 * En file (queue Redis) pour ne pas ralentir la vérification email. Le délai
 * éventuel porte la règle « âge minimum du compte » (réglage admin). Idempotent :
 * rejouable sans double crédit (transaction + lockForUpdate côté service).
 */
class EvaluateReferralRewards implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public int $referrerId) {}

    public function handle(ReferralRewardService $service): void
    {
        $referrer = User::find($this->referrerId);

        if ($referrer) {
            $service->evaluate($referrer);
        }
    }

    public function failed(Throwable $exception): void
    {
        report($exception);
    }
}
