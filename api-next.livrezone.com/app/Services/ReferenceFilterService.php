<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Language;
use App\Models\Level;
use Illuminate\Http\Request;

class ReferenceFilterService
{
    /**
     * Récupère la première valeur non vide parmi une liste de clés (dans une Request ou un tableau)
     * et la découpe en tableau de chaînes (support format CSV : "ROMANS,BD").
     */
    public function csvParam(Request|array $source, array|string $keys): array
    {
        $keys = is_array($keys) ? $keys : [$keys];
        $value = null;

        foreach ($keys as $key) {
            if ($source instanceof Request) {
                if ($source->has($key) && $source->filled($key)) {
                    $value = $source->get($key);
                    break;
                }
            } elseif (is_array($source)) {
                if (! empty($source[$key])) {
                    $value = $source[$key];
                    break;
                }
            }
        }

        if ($value === null) {
            return [];
        }

        $parts = is_array($value) ? $value : explode(',', (string) $value);

        return array_values(array_filter(array_map('trim', $parts), fn ($v) => $v !== ''));
    }

    /**
     * Découpe un paramètre CSV en entiers uniques.
     */
    public function csvIntParam(mixed $value): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        $parts = is_array($value) ? $value : explode(',', (string) $value);
        $ints = [];

        foreach ($parts as $part) {
            $trimmed = trim((string) $part);
            if (is_numeric($trimmed)) {
                $ints[] = (int) $trimmed;
            }
        }

        return array_values(array_unique($ints));
    }

    /**
     * Résout les IDs de catégories depuis des codes textuels ("ROMANS", "SCOLAIRE")
     * ou des IDs numériques, avec inclusion récursive des sous-catégories et affinage.
     */
    public function resolveCategoryIds(Request|array $source, array $keys = ['categories', 'category', 'category_id', 'c']): array
    {
        $rawValues = $this->csvParam($source, $keys);
        if (empty($rawValues)) {
            return [];
        }

        $codes = [];
        $numericIds = [];

        foreach ($rawValues as $val) {
            if (is_numeric($val)) {
                $numericIds[] = (int) $val;
            } else {
                $codes[] = $val;
            }
        }

        if (! empty($codes)) {
            $foundIds = Category::whereIn('code', $codes)->pluck('id')->all();
            $numericIds = array_merge($numericIds, $foundIds);
        }

        $numericIds = array_values(array_unique(array_filter($numericIds)));
        if (empty($numericIds)) {
            return [];
        }

        $allCategories = Category::all()->keyBy('id');

        // Affinage : si un parent ET son enfant sont cochés, on ne retient que l'enfant
        $selected = [];
        foreach ($numericIds as $catId) {
            $category = $allCategories->get($catId);
            if (! $category) {
                continue;
            }
            $descendants = array_diff($category->selfAndDescendantIds(), [$catId]);
            $hasSelectedDescendant = count(array_intersect($descendants, $numericIds)) > 0;
            if (! $hasSelectedDescendant) {
                $selected[] = $catId;
            }
        }

        $merged = [];
        foreach ($selected as $catId) {
            $category = $allCategories->get($catId);
            if (! $category) {
                continue;
            }
            $merged = array_merge($merged, $category->selfAndDescendantIds());
        }

        return array_values(array_unique($merged));
    }

    /**
     * Résout les IDs de langues depuis des codes ISO ("fr", "ar", "en") ou des IDs numériques.
     */
    public function resolveLanguageIds(Request|array $source, array $keys = ['languages', 'language', 'language_id', 'l']): array
    {
        $rawValues = $this->csvParam($source, $keys);
        if (empty($rawValues)) {
            return [];
        }

        $codes = [];
        $numericIds = [];

        foreach ($rawValues as $val) {
            if (is_numeric($val)) {
                $numericIds[] = (int) $val;
            } else {
                $codes[] = $val;
            }
        }

        if (! empty($codes)) {
            $foundIds = Language::whereIn('code', $codes)->pluck('id')->all();
            $numericIds = array_merge($numericIds, $foundIds);
        }

        return array_values(array_unique(array_filter($numericIds)));
    }

    /**
     * Résout les IDs de niveaux depuis des codes textuels ("1BAC", "C1") ou des IDs numériques.
     */
    public function resolveLevelIds(Request|array $source, array $keys = ['levels', 'level', 'level_id', 'lvl']): array
    {
        $rawValues = $this->csvParam($source, $keys);
        if (empty($rawValues)) {
            return [];
        }

        $codes = [];
        $numericIds = [];

        foreach ($rawValues as $val) {
            if (is_numeric($val)) {
                $numericIds[] = (int) $val;
            } else {
                $codes[] = $val;
            }
        }

        if (! empty($codes)) {
            $foundIds = Level::whereIn('code', $codes)->pluck('id')->all();
            $numericIds = array_merge($numericIds, $foundIds);
        }

        return array_values(array_unique(array_filter($numericIds)));
    }

    /**
     * Résout les IDs de villes valides.
     */
    public function resolveCityIds(Request|array $source, array $keys = ['city', 'cities', 'city_id']): array
    {
        $rawValues = $this->csvParam($source, $keys);
        $numericIds = [];

        foreach ($rawValues as $val) {
            if (is_numeric($val)) {
                $numericIds[] = (int) $val;
            }
        }

        return array_values(array_unique(array_filter($numericIds)));
    }
}
