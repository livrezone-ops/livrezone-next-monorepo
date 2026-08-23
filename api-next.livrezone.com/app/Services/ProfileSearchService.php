<?php

namespace App\Services;

use App\Models\Listing;
use App\Models\Profile;

class ProfileSearchService
{
    /**
     * Recalcule et persiste le nombre de publications (counter cache) d'un profil
     * vendeur, à partir de ses annonces publiées. `profile_book_conditions` est
     * déclaré à l'inscription et n'est pas dérivé des annonces.
     * Le save() déclenche la synchronisation Meilisearch (trait Searchable).
     */
    public function syncStats(Profile $profile): void
    {
        if ($profile->user_id === null) {
            $profile->listing_count = 0;
            $profile->save();
            return;
        }

        $count = Listing::query()
            ->where('user_id', $profile->user_id)
            ->where('status', 'published')
            ->count();

        $profile->listing_count = (int) $count;

        $profile->save();
    }
}
