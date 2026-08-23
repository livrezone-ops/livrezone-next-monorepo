<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Models\Profile;
use App\Models\Listing;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

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

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Début du traitement des abonnements expirés...');

        $maxFreeListings = (int) env('MAX_FREE_LISTINGS', 25);
        $gracePeriodDays = (int) env('SUBSCRIPTION_GRACE_PERIOD_DAYS', 15);

        // On récupère tous les profils qui sont actuellement Pro ou Premium
        $activeProProfiles = Profile::whereIn('subscription_type', ['pro', 'premium'])->get();

        foreach ($activeProProfiles as $profile) {
            // Trouver le dernier paiement validé pour cet utilisateur
            $lastPayment = DB::table('payments')
                ->where('user_id', $profile->user_id)
                ->where('status', 'paid')
                ->orderByDesc('expires_at')
                ->first();

            // S'il n'y a pas de paiement (anormal) ou si l'abonnement est expiré
            if (!$lastPayment || Carbon::parse($lastPayment->expires_at)->isPast()) {
                
                $this->info("Rétrogradation de l'utilisateur {$profile->user_id} en compte free.");
                
                // Rétrograde en free immédiatement pour bloquer les NOUVELLES publications
                $profile->update(['subscription_type' => 'free']);
            }
        }

        // --- GESTION DU DELAI DE GRACE ---
        // Chercher tous les profils "free" pour purger leurs annonces excédentaires si la période de grâce est passée.
        // On considère que la période de grâce est passée si le dernier paiement "pro/premium" est expiré depuis > $gracePeriodDays.
        
        $freeProfiles = Profile::where('subscription_type', 'free')->get();

        foreach ($freeProfiles as $profile) {
            $lastPayment = DB::table('payments')
                ->where('user_id', $profile->user_id)
                ->where('status', 'paid')
                ->orderByDesc('expires_at')
                ->first();

            // S'il n'y a jamais eu de paiement, ou si le dernier paiement est expiré depuis plus de X jours
            $isGracePeriodOver = true;
            
            if ($lastPayment) {
                $expiresAt = Carbon::parse($lastPayment->expires_at);
                if ($expiresAt->copy()->addDays($gracePeriodDays)->isFuture()) {
                    $isGracePeriodOver = false;
                }
            }

            if ($isGracePeriodOver) {
                // Vérifier si le user a plus de MAX_FREE_LISTINGS actives
                $activeListings = Listing::where('user_id', $profile->user_id)
                                         ->whereIn('status', ['published', 'pending_admin', 'pending_stock'])
                                         ->orderByDesc('updated_at')
                                         ->get();

                if ($activeListings->count() > $maxFreeListings) {
                    $this->info("Purge des annonces excédentaires pour l'utilisateur {$profile->user_id} (Délai de grâce expiré).");
                    
                    // On garde les $maxFreeListings premières (les plus récemment mises à jour)
                    $listingsToDeactivate = $activeListings->slice($maxFreeListings);

                    foreach ($listingsToDeactivate as $listing) {
                        $listing->update(['status' => 'inactive']);
                    }
                }
            }
        }

        $this->info('Traitement terminé.');
    }
}
