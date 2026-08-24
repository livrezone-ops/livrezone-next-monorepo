<?php

namespace App\Console\Commands;

use App\Services\SubscriptionService;
use Illuminate\Console\Command;

class ProcessExpiredSubscriptions extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:process-subscriptions';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Vérifie les abonnements expirés, rétrograde les comptes en Free, et désactive les annonces excédentaires après le délai de grâce.';

    public function __construct(protected SubscriptionService $subscriptionService)
    {
        parent::__construct();
    }

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Début du traitement des abonnements expirés...');

        $this->subscriptionService->processExpirations();

        $this->info('Traitement terminé.');
    }
}
