<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Règles communes à la création et à la mise à jour d'une annonce
 * (ex-validateListing() du ListingManagerController, partagées par
 * store() et update()).
 */
class ListingUpsertRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'book_id' => 'nullable|integer|exists:books,id',
            'title' => 'required|string|max:255',
            'author' => 'nullable|string|max:255',
            'publisher' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'book_condition' => 'required|in:neuf,occas',
            'price' => 'required|numeric|min:0',
            'discount_price' => 'nullable|numeric|min:0|lt:price',
            'quantity' => 'nullable|integer|min:1',
            'category_id' => 'required|exists:categories,id',
            'parent_category_id' => 'nullable|integer|exists:categories,id',
            'level_id' => 'nullable|integer',
            'subject_id' => 'nullable|integer',
            'language_id' => 'nullable|exists:languages,id',
            'isbn_13' => 'nullable|string|max:20',
            'cover_image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:4096',
            'cover_source_url' => 'nullable|url',
        ];
    }
}
