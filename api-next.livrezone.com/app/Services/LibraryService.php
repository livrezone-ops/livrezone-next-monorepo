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
        $cityInput = $request->input('city');
        $cityIds = [];
        if (is_array($cityInput)) {
            $cityIds = array_map('intval', $cityInput);
        } elseif (is_string($cityInput) && $cityInput !== '') {
            $cityIds = array_map('intval', explode(',', $cityInput));
        } elseif (is_numeric($cityInput)) {
            $cityIds = [(int) $cityInput];
        }

        $condition = $request->input('condition');
        $search = $request->input('search');
        $sort = $request->input('sort', 'rating');

        // Moteur de recherche par défaut : Meilisearch (index "profiles").
        // La recherche plein texte porte strictement sur le nickname
        // (searchableAttributes = ['nickname'] côté index).
        $builder = Profile::search($search ?: '');

        // Annuaire des librairies : on ne liste que les profils de type librairie.
        $builder->where('profile_type', 'librairie');

        if (!empty($cityIds)) {
            $builder->whereIn('city_id', $cityIds);
        }

        $conditionsInput = $request->input('condition');
        $conditions = [];
        if (is_array($conditionsInput)) {
            $conditions = $conditionsInput;
        } elseif (is_string($conditionsInput) && $conditionsInput !== '') {
            $conditions = explode(',', $conditionsInput);
        }
        $validConditions = array_intersect($conditions, ['neuf', 'occas']);
        if (!empty($validConditions)) {
            $builder->whereIn('profile_book_conditions', $validConditions);
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

        // Extraction des facettes
        $facets = ['cities' => [], 'conditions' => []];
        try {
            // Villes : source = index "profiles" (librairies). On affiche
            // toutes les villes ayant au moins une librairie, y compris la
            // ville par défaut "Autre", avec le compte de librairies par ville.
            $libFacetBuilder = Profile::search('', function ($meilisearch, $query, $options) {
                $options['facets'] = ['city_id'];
                $options['hitsPerPage'] = 0;
                return $meilisearch->search($query, $options);
            });
            $libFacetBuilder->where('profile_type', 'librairie');

            $rawLibFacets = $libFacetBuilder->raw();
            $libFacetDistribution = $rawLibFacets['facetDistribution']['city_id'] ?? [];
            foreach ($libFacetDistribution as $id => $count) {
                $facets['cities'][(string)$id] = $count;
            }

            // Conditions : source = index "profiles" (librairies).
            $conditionFacetBuilder = Profile::search($search ?: '', function ($meilisearch, $query, $options) {
                $options['facets'] = ['profile_book_conditions'];
                $options['hitsPerPage'] = 0;
                return $meilisearch->search($query, $options);
            });
            $conditionFacetBuilder->where('profile_type', 'librairie');
            if (!empty($validConditions)) {
                $conditionFacetBuilder->whereIn('profile_book_conditions', $validConditions);
            }

            $rawConditionFacets = $conditionFacetBuilder->raw();
            $conditionFacets = $rawConditionFacets['facetDistribution']['profile_book_conditions'] ?? [];
            foreach ($conditionFacets as $code => $count) {
                $facets['conditions'][$code] = $count;
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::warning('Meilisearch Library facets failed: ' . $e->getMessage());
        }

        return [
            'data' => $data,
            'total' => $paginator->total(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'facets' => $facets,
        ];
    }
}
