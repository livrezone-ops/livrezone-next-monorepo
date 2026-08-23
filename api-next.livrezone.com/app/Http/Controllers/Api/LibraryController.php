<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LibraryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LibraryController extends Controller
{
    /**
     * Liste publique des librairies (profils vendeurs) avec filtres et tri.
     * Filtres : ville, condition des livres, recherche par nom.
     * Tri : rating ou nombre de publications (le tri par type de compte reste
     * toujours prioritaire pour valoriser les comptes payants).
     */
    public function publicLibraries(Request $request, LibraryService $service): JsonResponse
    {
        $request->validate([
            'city' => ['nullable', 'integer', 'exists:cities,id'],
            'condition' => ['nullable', 'string', 'in:neuf,occas'],
            'search' => ['nullable', 'string', 'max:255'],
            'sort' => ['nullable', 'string', 'in:rating,publications'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $result = $service->search($request);

        return response()->json([
            'data' => $result['data'],
            'total' => $result['total'],
            'current_page' => $result['current_page'],
            'last_page' => $result['last_page'],
            'facets' => $result['facets'] ?? null,
        ]);
    }
}
