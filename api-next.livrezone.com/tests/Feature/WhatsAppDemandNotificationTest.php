<?php

namespace Tests\Feature;

use App\Jobs\NotifyDemandersOnListingPublished;
use App\Models\Book;
use App\Models\City;
use App\Models\Listing;
use App\Models\NotificationPreference;
use App\Models\Order;
use App\Models\Profile;
use App\Models\User;
use App\Services\WhatsAppNotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * Notifications WhatsApp aux demandeurs :
 * - publication d'une annonce qui matche une demande (ISBN ou titre) ;
 * - opt-in strict (has_whatsapp + préférence canal whatsapp) ;
 * - flag available_listings_count à la création d'une demande.
 */
class WhatsAppDemandNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Engine sans réseau : évite les appels Meilisearch réels lors des
        // synchronisations Scout déclenchées par les observers (profiles).
        config(['scout.driver' => 'null']);
    }

    private function enableWhatsappConfig(): void
    {
        config([
            'services.whatsapp.enabled' => true,
            'services.whatsapp.api_url' => 'http://evolution-api.test',
            'services.whatsapp.api_key' => 'test-key',
            'services.whatsapp.instance' => 'livrezone',
        ]);
    }

    private function makeUserWithProfile(?string $phone = null, bool $hasWhatsapp = false): User
    {
        $user = User::factory()->create();
        $city = City::query()->firstOrCreate(['name' => 'Ville de test']);

        Profile::withoutSyncingToSearch(fn () => Profile::create([
            'user_id' => $user->id,
            'subscription_type' => 'free',
            'city_id' => $city->id,
            'phone' => $phone,
            'has_whatsapp' => $hasWhatsapp,
        ]));

        return $user;
    }

    private function setWhatsappPreference(User $user, bool $enabled): void
    {
        NotificationPreference::create([
            'user_id' => $user->id,
            'notification_type' => 'book_orders',
            'channel' => 'whatsapp',
            'is_enabled' => $enabled,
        ]);
    }

    private function createPublishedListing(User $seller, string $title, ?string $isbn = null): Listing
    {
        return Listing::withoutSyncingToSearch(fn () => Listing::create([
            'user_id' => $seller->id,
            'title' => $title,
            'isbn_13' => $isbn,
            'book_condition' => 'occas',
            'price' => 120,
            'status' => 'published',
        ]));
    }

    public function test_published_listing_sends_whatsapp_to_matching_demander(): void
    {
        $this->enableWhatsappConfig();
        Http::fake(['*/message/sendText/*' => Http::response(['success' => true])]);

        $demander = $this->makeUserWithProfile('0661234567', hasWhatsapp: true);
        $this->setWhatsappPreference($demander, true);
        Order::withoutSyncingToSearch(fn () => Order::create([
            'user_id' => $demander->id,
            'title' => 'Les Misérables',
            'isbn' => '9781234567890',
            'status' => 'published',
        ]));

        $seller = User::factory()->create();
        $listing = $this->createPublishedListing($seller, 'Les Misérables', '9781234567890');

        (new NotifyDemandersOnListingPublished($listing))->handle(app(WhatsAppNotificationService::class));

        Http::assertSent(function ($request) {
            return str_contains($request->url(), '/message/sendText/livrezone')
                && $request['number'] === '212661234567'
                && str_contains((string) $request['text'], 'Les Misérables');
        });
    }

    public function test_whatsapp_defaults_and_explicit_opt_out(): void
    {
        $this->enableWhatsappConfig();
        Http::fake();
        // Sync queue : sans Queue::fake(), l'observer exécuterait déjà le job
        // à chaque création d'annonce (double envoi avec l'appel manuel).
        Queue::fake();

        // Cas 1 : aucune préférence enregistrée + has_whatsapp → défaut activé, envoi attendu
        $withDefault = $this->makeUserWithProfile('0661234567', hasWhatsapp: true);
        Order::withoutSyncingToSearch(fn () => Order::create([
            'user_id' => $withDefault->id,
            'title' => 'Antigone',
            'isbn' => '9780000000001',
            'status' => 'published',
        ]));

        // Cas 2 : préférence explicitement désactivée → aucun envoi
        $optedOut = $this->makeUserWithProfile('0664234571', hasWhatsapp: true);
        $this->setWhatsappPreference($optedOut, false);
        Order::withoutSyncingToSearch(fn () => Order::create([
            'user_id' => $optedOut->id,
            'title' => 'Médée',
            'isbn' => '9780000000005',
            'status' => 'published',
        ]));

        // Cas 3 : préférence activée mais numéro sans WhatsApp → aucun envoi
        $withoutWhatsapp = $this->makeUserWithProfile('0662234568', hasWhatsapp: false);
        $this->setWhatsappPreference($withoutWhatsapp, true);
        Order::withoutSyncingToSearch(fn () => Order::create([
            'user_id' => $withoutWhatsapp->id,
            'title' => 'Hamlet',
            'isbn' => '9780000000002',
            'status' => 'published',
        ]));

        $seller = User::factory()->create();

        // Défaut activé : le demandeur sans préférence reçoit le message
        (new NotifyDemandersOnListingPublished(
            $this->createPublishedListing($seller, 'Antigone')
        ))->handle(app(WhatsAppNotificationService::class));

        Http::assertSent(fn ($request) => $request['number'] === '212661234567');

        // Désactivation explicite et numéro sans WhatsApp : aucun envoi
        (new NotifyDemandersOnListingPublished(
            $this->createPublishedListing($seller, 'Médée')
        ))->handle(app(WhatsAppNotificationService::class));
        (new NotifyDemandersOnListingPublished(
            $this->createPublishedListing($seller, 'Hamlet')
        ))->handle(app(WhatsAppNotificationService::class));

        // Annonce sans correspondance : aucun envoi supplémentaire
        (new NotifyDemandersOnListingPublished(
            $this->createPublishedListing($seller, 'Livre sans rapport', '9789999999999')
        ))->handle(app(WhatsAppNotificationService::class));

        Http::assertSentCount(1);
    }

    public function test_no_self_notification_for_own_listing(): void
    {
        $this->enableWhatsappConfig();
        Http::fake();

        $user = $this->makeUserWithProfile('0663234569', hasWhatsapp: true);
        $this->setWhatsappPreference($user, true);
        Order::withoutSyncingToSearch(fn () => Order::create([
            'user_id' => $user->id,
            'title' => 'Le Petit Prince',
            'isbn' => '9780000000003',
            'status' => 'published',
        ]));

        $listing = $this->createPublishedListing($user, 'Le Petit Prince', '9780000000003');
        (new NotifyDemandersOnListingPublished($listing))->handle(app(WhatsAppNotificationService::class));

        Http::assertNothingSent();
    }

    public function test_observer_dispatches_job_only_on_transition_to_published(): void
    {
        Queue::fake();
        $seller = User::factory()->create();

        // Création auto-validée
        $published = $this->createPublishedListing($seller, 'Nouveauté publiée', '9780000000010');
        Queue::assertPushed(NotifyDemandersOnListingPublished::class);

        // Re-sauvegarde sans changement de statut : aucun nouveau job
        Queue::fake();
        $published->price = 99;
        $published->save();
        Queue::assertNotPushed(NotifyDemandersOnListingPublished::class);

        // Transition brouillon -> publié
        Queue::fake();
        $draft = Listing::withoutSyncingToSearch(fn () => Listing::create([
            'user_id' => $seller->id,
            'title' => 'Brouillon à publier',
            'book_condition' => 'neuf',
            'price' => 50,
            'status' => 'pending_admin',
        ]));
        $draft->status = 'published';
        $draft->save();
        Queue::assertPushed(NotifyDemandersOnListingPublished::class);
    }

    public function test_republish_of_auto_published_listing_dispatches_job(): void
    {
        // Comme DashboardController::republish : la copie repasse par les
        // événements modèle (created) et doit alerter les demandeurs.
        Queue::fake();

        // Annonce rattachée au catalogue (title + ISBN identiques au book)
        // → determineRepublishStatus la republie automatiquement.
        $seller = User::factory()->create();
        $demander = $this->makeUserWithProfile('0664234570', hasWhatsapp: true);
        $this->setWhatsappPreference($demander, true);
        Order::withoutSyncingToSearch(fn () => Order::create([
            'user_id' => $demander->id,
            'title' => 'Livre republié',
            'isbn' => '9780000000040',
            'status' => 'published',
        ]));

        $book = Book::withoutSyncingToSearch(fn () => Book::create([
            'title' => 'Livre republié',
            'isbn_13' => '9780000000040',
        ]));

        $archived = Listing::withoutSyncingToSearch(fn () => Listing::create([
            'user_id' => $seller->id,
            'title' => 'Livre republié',
            'isbn_13' => '9780000000040',
            'book_id' => $book->id,
            'book_condition' => 'occas',
            'price' => 80,
            'status' => 'published',
        ]));
        $archived->update(['status' => 'archived']);
        Queue::fake();
        Queue::assertNotPushed(NotifyDemandersOnListingPublished::class);

        $response = $this->actingAs($seller)
            ->postJson("/api/dashboard/listings/{$archived->id}/republish");

        $response->assertCreated()
            ->assertJsonPath('listing.status', 'published');
        Queue::assertPushed(NotifyDemandersOnListingPublished::class);
    }

    public function test_order_store_returns_available_listings_count(): void
    {
        $buyer = User::factory()->create();
        $seller = User::factory()->create();
        $this->createPublishedListing($seller, 'Livre déjà en vente', '9780000000020');

        $response = $this->actingAs($buyer)->postJson('/api/orders', [
            'title' => 'Livre déjà en vente',
            'isbn' => '9780000000020',
        ]);

        $response->assertCreated()
            ->assertJsonPath('order.available_listings_count', 1);
    }

    public function test_listings_endpoint_supports_isbn_filter(): void
    {
        $seller = User::factory()->create();
        $matching = $this->createPublishedListing($seller, 'Cible ISBN', '9780000000030');
        $this->createPublishedListing($seller, 'Autre livre', '9780000000031');

        $response = $this->getJson('/api/listings?isbn=978-0000000030');

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertSame([$matching->id], $ids);
    }
}
