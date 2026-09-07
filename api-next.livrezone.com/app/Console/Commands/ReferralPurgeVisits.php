<?php

namespace App\Console\Commands;

use App\Models\ReferralVisit;
use Illuminate\Console\Command;

class ReferralPurgeVisits extends Command
{
    protected $signature = 'referral:purge-visits {--days=90 : Âge (jours) au-delà duquel les visites sont purgées}';

    protected $description = 'Purge les visites de parrainage au-delà de N jours (RGPD + volume). Les compteurs agrégés sur users ne sont pas touchés.';

    public function handle(): int
    {
        $days = max(7, (int) $this->option('days'));

        $deleted = ReferralVisit::where('created_at', '<', now()->subDays($days))->delete();

        $this->info("Visites de parrainage purgées (> {$days} j) : {$deleted}.");

        return self::SUCCESS;
    }
}
