<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function __construct(
        protected OrderService $orderService
    ) {}

    /**
     * Liste publique des demandes publiées (pour /demandes).
     */
    public function publicDemandes(Request $request): JsonResponse
    {
        $filters = $request->only([
            'search',
            'category', 'categories', 'category_id', 'c',
            'city', 'cities', 'city_id',
            'language', 'languages', 'language_id', 'l',
        ]);
        $perPage = min(max((int) $request->get('limit', 12), 1), 50);

        $demandes = $this->orderService->getPublicDemandes($filters, $perPage);

        return response()->json($demandes);
    }

    /**
     * Liste des demandes de l'utilisateur connecté.
     */
    public function index(Request $request): JsonResponse
    {
        $status = $request->get('status', 'published');
        $orders = $this->orderService->getUserOrders($request->user(), $status);

        return response()->json(['orders' => $orders]);
    }

    /**
     * Fiche d'une demande.
     */
    public function show(Request $request, Order $order): JsonResponse
    {
        if ($order->user_id !== $request->user()->id && !$request->user()->is_admin) {
            abort(403, 'Non autorisé');
        }

        return response()->json(['order' => $order->load(['book', 'category'])]);
    }

    /**
     * Création d'une nouvelle demande (catalogue ou manuelle).
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'book_id' => 'nullable|integer|exists:books,id',
            'title' => 'required_without:book_id|nullable|string|max:255',
            'author' => 'nullable|string|max:255',
            'isbn' => 'nullable|string|max:50',
            'category_id' => 'nullable|integer|exists:categories,id',
            'comment' => 'nullable|string|max:1000',
            'cover_image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:4096',
        ]);

        $coverImage = $request->hasFile('cover_image') ? $request->file('cover_image') : null;
        $order = $this->orderService->createOrder($request->user(), $validated, $coverImage);

        $message = !empty($validated['book_id'])
            ? 'Votre demande a bien été enregistrée. Les vendeurs seront notifiés.'
            : 'Votre demande a été enregistrée et sera validée par un modérateur avant diffusion.';

        return response()->json([
            'message' => $message,
            'order' => $order
        ], 201);
    }

    /**
     * Modification d'une demande.
     */
    public function update(Request $request, Order $order): JsonResponse
    {
        if ($order->user_id !== $request->user()->id) {
            abort(403, 'Non autorisé');
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'author' => 'nullable|string|max:255',
            'isbn' => 'nullable|string|max:50',
            'category_id' => 'nullable|integer|exists:categories,id',
            'comment' => 'nullable|string|max:1000',
            'cover_image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:4096',
        ]);

        $coverImage = $request->hasFile('cover_image') ? $request->file('cover_image') : null;
        $updatedOrder = $this->orderService->updateOrder($order, $validated, $coverImage);

        return response()->json([
            'message' => 'Demande modifiée avec succès.',
            'order' => $updatedOrder
        ]);
    }

    /**
     * Annulation d'une demande.
     */
    public function cancel(Request $request, Order $order): JsonResponse
    {
        if ($order->user_id !== $request->user()->id) {
            abort(403, 'Non autorisé');
        }

        $cancelledOrder = $this->orderService->cancelOrder($order);

        return response()->json([
            'message' => 'Demande annulée avec succès',
            'order' => $cancelledOrder
        ]);
    }
}
