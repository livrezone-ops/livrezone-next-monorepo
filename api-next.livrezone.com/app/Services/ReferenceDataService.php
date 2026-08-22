<?php

namespace App\Services;

use App\Models\Category;
use App\Models\City;
use App\Models\Language;
use App\Models\Level;
use Illuminate\Support\Facades\Cache;

class ReferenceDataService
{
    /**
     * Get all reference data (categories, languages, levels, cities)
     * Cached in Redis for 24 hours.
     *
     * @return array
     */
    public function getAll(): array
    {
        $ttl = config('livrezone.cache_ttl.reference_data', 86400);
        return Cache::remember('reference_data', $ttl, function () {
            // 1. Catégories hiérarchiques (L1 avec leurs enfants L2 et L3)
            $categories = Category::with(['levels', 'subjects'])
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->get();
                
            $tree = $this->buildTree($categories, null);
            
            // 2. Langues
            $languages = Language::where('is_active', true)
                ->orderBy('name_fr')
                ->get(['id', 'name_fr', 'code'])
                ->toArray();
                
            // 3. Niveaux et matières
            $levels = Level::where('is_active', true)
                ->with(['subjects' => function ($query) {
                    $query->where('is_active', true);
                }])
                ->orderBy('rank')
                ->get()
                ->toArray();

            // 4. Villes
            $cities = City::orderBy('name')->get(['id', 'name'])->toArray();

            return [
                'categories' => $tree,
                'languages' => $languages,
                'levels' => $levels,
                'cities' => $cities,
            ];
        });
    }
    
    private function buildTree($elements, $parentId = null)
    {
        $branch = [];
        
        foreach ($elements as $element) {
            if ($element->parent_id == $parentId) {
                $children = $this->buildTree($elements, $element->id);
                
                $node = [
                    'id' => $element->id,
                    'name' => $element->name_fr,
                    'slug' => $element->slug,
                    'icon' => $element->icon,
                    'levels' => $element->levels
                        ->map(fn ($l) => ['id' => $l->id, 'code' => $l->code, 'name_fr' => $l->name_fr])
                        ->values()->toArray(),
                    'subjects' => $element->subjects
                        ->map(fn ($s) => ['id' => $s->id, 'code' => $s->code, 'name_fr' => $s->name_fr])
                        ->values()->toArray(),
                ];
                
                if ($children) {
                    $node['children'] = $children;
                }
                
                $branch[] = $node;
            }
        }
        
        return $branch;
    }
}
