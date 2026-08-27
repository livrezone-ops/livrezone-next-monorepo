<?php

namespace App\Policies;

use App\Models\Listing;
use App\Models\User;

class ListingPolicy
{
    public function view(?User $user, Listing $listing): bool
    {
        if ($listing->status === 'published') {
            return true;
        }

        if ($user === null) {
            return false;
        }

        return $user->id === $listing->user_id || $user->is_admin === true;
    }

    /**
     * Gestion vendeur (show/update/republish/updateStatus) : propriétaire seul.
     * La modération admin passe par des endpoints dédiés, pas par cette policy.
     */
    public function update(User $user, Listing $listing): bool
    {
        return $user->id === $listing->user_id;
    }
}
