<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Language;
use App\Models\Level;
use App\Models\Subject;

class ReferenceDataController extends Controller
{
    public function index()
    {
        // 1. Catégories hiérarchiques (L1 avec leurs enfants L2 et L3)
        // On récupère toutes les catégories actives et on les organise
        $categories = Category::with(['levels', 'subjects'])
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get();
            
        $tree = $this->buildTree($categories, null);
        
        // 2. Langues
        $languages = Language::where('is_active', true)
            ->orderBy('name_fr')
            ->get(['id', 'name_fr', 'code']);
            
        // 3. Niveaux et matières
        // Pour les niveaux, on peut inclure leurs matières associées si on utilise la relation `subjects`
        $levels = Level::where('is_active', true)
            ->with(['subjects' => function ($query) {
                $query->where('is_active', true);
            }])
            ->orderBy('rank')
            ->get();

        return response()->json([
            'categories' => $tree,
            'languages' => $languages,
            'levels' => $levels,
        ]);
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
                        ->values(),
                    'subjects' => $element->subjects
                        ->map(fn ($s) => ['id' => $s->id, 'code' => $s->code, 'name_fr' => $s->name_fr])
                        ->values(),
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
