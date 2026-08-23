<?php

namespace App\Observers;

use App\Models\Listing;
use App\Models\Profile;
use App\Services\ProfileSearchService;

class ListingObserver
{
    /**
     * Met à jour les statistiques de recherche du vendeur lorsqu'une annonce
     * change de statut, de condition, ou de propriétaire.
     */
    public function saved(Listing $listing): void
    {
        if (! $listing->wasRecentlyCreated
            && ! $listing->isDirty(['status', 'book_condition', 'user_id'])) {
            return;
        }

        $this->syncOwner($listing->user_id);

        // Si l'annonce a changé de propriétaire, resynchroniser l'ancien vendeur.
        if ($listing->isDirty('user_id')) {
            $original = $listing->getOriginal('user_id');
            if ($original) {
                $this->syncOwner((int) $original);
            }
        }
    }

    /**
     * Lors d'une suppression (y compris soft delete), on décrémente les compteurs.
     */
    public function deleted(Listing $listing): void
    {
        $this->syncOwner($listing->user_id);
    }

    protected function syncOwner(?int $userId): void
    {
        if ($userId === null) {
            return;
        }

        $profile = Profile::where('user_id', $userId)->first();
        if ($profile) {
            app(ProfileSearchService::class)->syncStats($profile);
        }
    }
}
