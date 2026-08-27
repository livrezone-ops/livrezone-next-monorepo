<?php

namespace Tests\Feature;

use App\Models\ChatMessage;
use App\Models\ChatThread;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Policies d'autorisation (constat audit S/qualité : checks manuels dispersés) :
 * - ListingPolicy@update : propriétaire SEUL (l'admin passe par la modération dédiée) ;
 * - ChatThreadPolicy@participate : l'un des deux participants ;
 * - ChatMessagePolicy@update/delete : auteur du message, dans le bon fil ;
 * - canal broadcast chat.thread.{id} : même règle que la policy fil.
 */
class AuthorizationPolicyTest extends TestCase
{
    use RefreshDatabase;

    private function createListing(User $user, string $status = 'published'): Listing
    {
        return Listing::withoutSyncingToSearch(fn () => Listing::create([
            'user_id' => $user->id,
            'title' => 'Livre test',
            'book_condition' => 'occas',
            'price' => 10,
            'status' => $status,
        ]));
    }

    private function createThread(User $one, User $two): ChatThread
    {
        return ChatThread::create([
            'user_one_id' => min($one->id, $two->id),
            'user_two_id' => max($one->id, $two->id),
        ]);
    }

    public function test_listing_update_policy_allows_owner_only(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $admin = User::factory()->create(['is_admin' => true]);
        $listing = $this->createListing($owner);

        $this->assertTrue(Gate::forUser($owner)->allows('update', $listing));
        $this->assertTrue(Gate::forUser($other)->denies('update', $listing));
        // Sémantique verrouillée : l'admin n'est PAS autorisé par cette policy
        // (la modération admin passe par les endpoints /admin dédiés).
        $this->assertTrue(Gate::forUser($admin)->denies('update', $listing));
    }

    public function test_owner_can_update_his_listing_via_endpoint(): void
    {
        $owner = User::factory()->create();
        $listing = $this->createListing($owner, status: 'archived');

        Sanctum::actingAs($owner);

        $this->postJson("/api/dashboard/listings/{$listing->id}/inline-edit", [
            'title' => 'Titre modifié',
            'price' => 12,
        ])->assertOk();
    }

    public function test_foreign_user_cannot_touch_listing_endpoints(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $listing = $this->createListing($owner, status: 'archived');

        Sanctum::actingAs($other);

        $this->getJson("/api/dashboard/listings/{$listing->id}")
            ->assertStatus(403)
            ->assertJsonPath('message', 'Non autorisé');

        $this->postJson("/api/dashboard/listings/{$listing->id}/inline-edit", [
            'title' => 'Hack',
            'price' => 1,
        ])->assertStatus(403);

        $this->postJson("/api/dashboard/listings/{$listing->id}/status", ['status' => 'archived'])
            ->assertStatus(403);

        $this->postJson("/api/dashboard/listings/{$listing->id}/republish")
            ->assertStatus(403);
    }

    public function test_chat_thread_participate_policy(): void
    {
        $one = User::factory()->create();
        $two = User::factory()->create();
        $outsider = User::factory()->create();
        $thread = $this->createThread($one, $two);

        $this->assertTrue(Gate::forUser($one)->allows('participate', $thread));
        $this->assertTrue(Gate::forUser($two)->allows('participate', $thread));
        $this->assertTrue(Gate::forUser($outsider)->denies('participate', $thread));
    }

    public function test_outsider_cannot_read_chat_thread(): void
    {
        $one = User::factory()->create();
        $two = User::factory()->create();
        $outsider = User::factory()->create();
        $thread = $this->createThread($one, $two);

        Sanctum::actingAs($outsider);

        $this->getJson("/api/chat/threads/{$thread->id}")
            ->assertStatus(403)
            ->assertJsonPath('message', 'Accès refusé.');
    }

    public function test_chat_message_policy_allows_author_in_thread_only(): void
    {
        $one = User::factory()->create();
        $two = User::factory()->create();
        $threadA = $this->createThread($one, $two);
        $threadB = $this->createThread($one, User::factory()->create());

        $message = ChatMessage::create([
            'chat_thread_id' => $threadA->id,
            'sender_id' => $one->id,
            'message' => 'Bonjour',
        ]);

        $this->assertTrue(Gate::forUser($one)->allows('update', [$message, $threadA]));
        $this->assertTrue(Gate::forUser($one)->allows('delete', [$message, $threadA]));
        // L'autre participant du fil n'est pas l'auteur.
        $this->assertTrue(Gate::forUser($two)->denies('update', [$message, $threadA]));
        // Le message n'appartient pas à ce fil.
        $this->assertTrue(Gate::forUser($one)->denies('update', [$message, $threadB]));
    }

    public function test_participant_cannot_edit_foreign_message(): void
    {
        $one = User::factory()->create();
        $two = User::factory()->create();
        $thread = $this->createThread($one, $two);
        $message = ChatMessage::create([
            'chat_thread_id' => $thread->id,
            'sender_id' => $one->id,
            'message' => 'Bonjour',
        ]);

        Sanctum::actingAs($two);

        $this->postJson("/api/chat/threads/{$thread->id}/messages/{$message->id}/update", [
            'message' => 'Détourné',
        ])->assertStatus(403)
            ->assertJsonPath('message', 'Vous ne pouvez modifier que vos propres messages.');

        $this->postJson("/api/chat/threads/{$thread->id}/messages/{$message->id}/delete")
            ->assertStatus(403)
            ->assertJsonPath('message', 'Vous ne pouvez supprimer que vos propres messages.');

        // Le message n'a ni été modifié ni supprimé.
        $this->assertSame('Bonjour', $message->fresh()->message);
        $this->assertDatabaseHas('chat_messages', ['id' => $message->id]);
    }
}
