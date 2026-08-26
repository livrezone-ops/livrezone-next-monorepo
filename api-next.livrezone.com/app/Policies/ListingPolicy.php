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
}
