<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\CartDestroyRequest;
use App\Http\Requests\Api\CartMergeRequest;
use App\Http\Requests\Api\CartStoreRequest;
use App\Http\Requests\Api\CartUpdateRequest;
use App\Models\CartItem;
use App\Models\Listing;
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
     * Ajoute un article au panier (quantité bornée par le stock du listing).
     */
    public function store(CartStoreRequest $request): JsonResponse
    {
        $listingId = $request->integer('listing_id');
        $maxQty = $this->maxQuantityFor($listingId);
        $qty = max(1, min($maxQty, $request->integer('quantity', 1)));

        $item = CartItem::create([
            'user_id' => $request->user()->id,
            'listing_id' => $listingId,
            'quantity' => $qty,
        ]);

        return response()->json([
            'data' => $item,
            'message' => 'Article ajouté au panier.',
        ], 201);
    }

    /**
     * PUT /api/cart
     * Met à jour la quantité d'un article du panier (bornée par le stock).
     */
    public function update(CartUpdateRequest $request): JsonResponse
    {
        $listingId = $request->integer('listing_id');
        $maxQty = $this->maxQuantityFor($listingId);

        $item = CartItem::query()
            ->where('user_id', $request->user()->id)
            ->where('listing_id', $listingId)
            ->firstOrFail();

        $item->update([
            'quantity' => max(1, min($maxQty, $request->integer('quantity'))),
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
     * Les quantités sont cumulées si l'article existe déjà, puis bornées par
     * la quantité disponible du listing (stock), plafonnée à 99.
     */
    public function merge(CartMergeRequest $request): JsonResponse
    {
        $userId = $request->user()->id;
        $merged = 0;
        $clamped = 0;

        foreach ($request->input('items') as $row) {
            $listingId = (int) $row['listing_id'];
            $quantity = (int) ($row['quantity'] ?? 1);

            // Stock disponible sur le listing, plafonné à 99.
            $maxQty = $this->maxQuantityFor($listingId);

            $item = CartItem::query()
                ->where('user_id', $userId)
                ->where('listing_id', $listingId)
                ->first();

            if ($item) {
                $target = min($maxQty, $item->quantity + $quantity);
                if ($target < $item->quantity + $quantity) {
                    $clamped++;
                }
                $item->update(['quantity' => $target]);
            } else {
                $target = min($maxQty, $quantity);
                if ($target < $quantity) {
                    $clamped++;
                }
                CartItem::create([
                    'user_id' => $userId,
                    'listing_id' => $listingId,
                    'quantity' => $target,
                ]);
            }
            $merged++;
        }

        $count = CartItem::query()->where('user_id', $userId)->sum('quantity');

        return response()->json([
            'merged' => $merged,
            'clamped' => $clamped,
            'count' => $count,
            'message' => 'Panier synchronisé.',
        ]);
    }

    /**
     * Retourne la quantité maximale autorisée pour un listing :
     * le stock disponible (colonne quantity), plafonné entre 1 et 99.
     */
    private function maxQuantityFor(int $listingId): int
    {
        $available = (int) (Listing::query()
            ->where('id', $listingId)
            ->value('quantity') ?? 1);

        return max(1, min(99, $available));
    }
}
