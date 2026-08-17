<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\CartDestroyRequest;
use App\Http\Requests\Api\CartMergeRequest;
use App\Http\Requests\Api\CartStoreRequest;
use App\Http\Requests\Api\CartUpdateRequest;
use App\Models\CartItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CartController extends Controller
{
    /**
     * GET /api/cart
     * Liste les articles du panier de l'utilisateur connecté,
     * regroupés et ventilés par vendeur (marketplace multi-vendeurs).
     */
    public function index(Request $request): JsonResponse
    {
        $items = CartItem::with(['listing.book', 'listing.category', 'listing.user.profile.city'])
            ->where('user_id', $request->user()->id)
            ->latest()
            ->get()
            ->map(function (CartItem $item) {
                $listing = $item->listing;
                if ($listing && $listing->book) {
                    $listing->book->setAppends(['cover_url']);
                }
                $item->setAttribute('listing', $listing);

                return $item;
            });

        $sellers = $items->groupBy(function (CartItem $item) {
            return $item->listing?->user_id ?? 'inconnu';
        })->map(function ($group) {
            $seller = $group->first()->listing?->user;

            $subtotal = $group->sum(function (CartItem $item) {
                $price = $item->listing?->discount_price ?? $item->listing?->price ?? 0;

                return (float) $price * $item->quantity;
            });

            return [
                'seller' => $seller ? [
                    'id' => $seller->id,
                    'nickname' => $seller->profile?->nickname ?? 'utilisateur-'.$seller->id,
                    'city' => $seller->profile?->city?->name,
                ] : null,
                'items' => $group->values(),
                'item_count' => $group->sum('quantity'),
                'subtotal' => round($subtotal, 2),
            ];
        })->values();

        $total = $sellers->sum('subtotal');

        return response()->json([
            'data' => $sellers,
            'count' => $items->sum('quantity'),
            'total' => round($total, 2),
        ]);
    }

    /**
     * POST /api/cart
     * Ajoute un article au panier.
     */
    public function store(CartStoreRequest $request): JsonResponse
    {
        $item = CartItem::create([
            'user_id' => $request->user()->id,
            'listing_id' => $request->integer('listing_id'),
            'quantity' => $request->integer('quantity', 1),
        ]);

        return response()->json([
            'data' => $item,
            'message' => 'Article ajouté au panier.',
        ], 201);
    }

    /**
     * PUT /api/cart
     * Met à jour la quantité d'un article du panier.
     */
    public function update(CartUpdateRequest $request): JsonResponse
    {
        $item = CartItem::query()
            ->where('user_id', $request->user()->id)
            ->where('listing_id', $request->integer('listing_id'))
            ->firstOrFail();

        $item->update([
            'quantity' => $request->integer('quantity'),
        ]);

        return response()->json([
            'data' => $item,
            'message' => 'Quantité mise à jour.',
        ]);
    }

    /**
     * DELETE /api/cart
     * Retire un article du panier.
     */
    public function destroy(CartDestroyRequest $request): JsonResponse
    {
        $deleted = CartItem::query()
            ->where('user_id', $request->user()->id)
            ->where('listing_id', $request->integer('listing_id'))
            ->delete();

        return response()->json([
            'deleted' => $deleted > 0,
            'message' => $deleted > 0
                ? 'Article retiré du panier.'
                : 'Cet article n\'était pas dans votre panier.',
        ]);
    }

    /**
     * POST /api/cart/merge
     * Fusionne le panier local (guest < 24h) vers le compte connecté.
     * Les quantités sont cumulées si l'article existe déjà.
     */
    public function merge(CartMergeRequest $request): JsonResponse
    {
        $userId = $request->user()->id;
        $merged = 0;

        foreach ($request->input('items') as $row) {
            $listingId = (int) $row['listing_id'];
            $quantity = (int) ($row['quantity'] ?? 1);

            $item = CartItem::query()
                ->where('user_id', $userId)
                ->where('listing_id', $listingId)
                ->first();

            if ($item) {
                $item->increment('quantity', $quantity);
            } else {
                CartItem::create([
                    'user_id' => $userId,
                    'listing_id' => $listingId,
                    'quantity' => $quantity,
                ]);
            }
            $merged++;
        }

        $count = CartItem::query()->where('user_id', $userId)->sum('quantity');

        return response()->json([
            'merged' => $merged,
            'count' => $count,
            'message' => 'Panier synchronisé.',
        ]);
    }
}
