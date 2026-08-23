<?php

namespace App\Services;

use App\Models\Profile;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;

class LibraryService
{
    private const PER_PAGE = 12;

    public function search(Request $request): array
    {
        $cityId = $request->filled('city') ? (int) $request->input('city') : null;
        $condition = $request->input('condition');
        $search = $request->input('search');
        $sort = $request->input('sort', 'rating');

        // Moteur de recherche par défaut : Meilisearch (index "profiles").
        // La recherche plein texte porte strictement sur le nickname
        // (searchableAttributes = ['nickname'] côté index).
        $builder = Profile::search($search ?: '');

        // Annuaire des librairies : on ne liste que les profils de type librairie.
        $builder->where('profile_type', 'librairie');

        if ($cityId) {
            $builder->where('city_id', $cityId);
        }

        if (in_array($condition, ['neuf', 'occas'], true)) {
            $builder->where('profile_book_conditions', $condition);
        }

        // Tri principal imposé : visibilité maximale des comptes payants
        // (subscription_rank : premium 3 > pro 2 > free 1), toujours en tête.
        $builder->orderBy('subscription_rank', 'desc');

        // Tri secondaire au choix de l'utilisateur.
        if ($sort === 'publications') {
            $builder->orderBy('listing_count', 'desc');
        } else {
            $builder->orderBy('rating_average', 'desc');
        }

        $builder->orderBy('id', 'desc');

        /** @var LengthAwarePaginator $paginator */
        $paginator = $builder->paginate(self::PER_PAGE);

        $paginator->getCollection()->load(['city']);

        $data = $paginator->getCollection()->map(function (Profile $profile) {
            return [
                'id' => $profile->id,
                'user_id' => $profile->user_id,
                'nickname' => $profile->nickname,
                'name' => $profile->nickname,
                'profile_type' => $profile->profile_type,
                'subscription_type' => $profile->subscription_type,
                'logo' => $profile->logo,
                'adresse' => $profile->adresse,
                'rating_average' => (float) $profile->rating_average,
                'rating_count' => (int) $profile->rating_count,
                'listing_count' => (int) $profile->listing_count,
                'city' => $profile->city ? [
                    'id' => $profile->city->id,
                    'name' => $profile->city->name,
                ] : null,
            ];
        })->values()->all();

        return [
            'data' => $data,
            'total' => $paginator->total(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
        ];
    }
}
