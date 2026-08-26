<?php

namespace Tests\Feature;

use App\Models\ChatMessage;
use App\Models\ChatThread;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ChatTest extends TestCase
{
    use RefreshDatabase;

    /**
     * POST /api/chat/threads : crée un fil entre deux utilisateurs.
     */
    public function test_can_create_a_thread_between_two_users(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/chat/threads', [
            'user_id' => $other->id,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.other_user.id', $other->id)
            ->assertJsonPath('data.created', true);

        $this->assertDatabaseHas('chat_threads', [
            'user_one_id' => min($user->id, $other->id),
            'user_two_id' => max($user->id, $other->id),
        ]);
    }

    /**
     * POST /api/chat/threads : réutilise un fil existant (idempotent).
     */
    public function test_store_reuses_existing_thread(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        ChatThread::getOrCreateThread($user->id, $other->id);

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/chat/threads', [
            'user_id' => $other->id,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.created', false);

        $this->assertDatabaseCount('chat_threads', 1);
    }

    /**
     * POST /api/chat/threads : interdit de discuter avec soi-même (422).
     */
    public function test_cannot_create_thread_with_self(): void
    {
        $user = User::factory()->create();

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/chat/threads', [
            'user_id' => $user->id,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('user_id');
    }

    /**
     * POST /api/chat/threads/{thread}/messages : envoie un message et
     * met à jour last_message_at.
     */
    public function test_can_send_a_message_in_thread(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        $thread = ChatThread::getOrCreateThread($user->id, $other->id);

        Sanctum::actingAs($user);

        $response = $this->postJson("/api/chat/threads/{$thread->id}/messages", [
            'message' => 'Bonjour, le livre est-il disponible ?',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.message', 'Bonjour, le livre est-il disponible ?')
            ->assertJsonPath('data.sender_id', $user->id);

        $this->assertDatabaseHas('chat_messages', [
            'chat_thread_id' => $thread->id,
            'sender_id' => $user->id,
        ]);

        $this->assertNotNull($thread->fresh()->last_message_at);
    }

    /**
     * POST /api/chat/threads/{thread}/messages : message vide -> 422.
     */
    public function test_message_cannot_be_empty(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        $thread = ChatThread::getOrCreateThread($user->id, $other->id);

        Sanctum::actingAs($user);

        $response = $this->postJson("/api/chat/threads/{$thread->id}/messages", [
            'message' => '   ',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('message');
    }

    /**
     * GET /api/chat/threads : liste les fils avec le nombre de non-lus.
     */
    public function test_index_lists_threads_with_unread_count(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        $thread = ChatThread::getOrCreateThread($user->id, $other->id);

        // L'autre utilisateur envoie 2 messages non lus.
        ChatMessage::create([
            'chat_thread_id' => $thread->id,
            'sender_id' => $other->id,
            'message' => 'Premier message',
        ]);
        ChatMessage::create([
            'chat_thread_id' => $thread->id,
            'sender_id' => $other->id,
            'message' => 'Deuxième message',
        ]);

        $thread->update(['last_message_at' => now()]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/chat/threads');

        $response->assertOk()
            ->assertJsonPath('total_unread', 2)
            ->assertJsonPath('data.0.unread_count', 2)
            ->assertJsonPath('data.0.other_user.id', $other->id)
            ->assertJsonPath('data.0.last_message.message', 'Deuxième message');
    }

    /**
     * POST /api/chat/threads/{thread}/read : marque comme lus les messages reçus.
     */
    public function test_mark_read_updates_messages(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        $thread = ChatThread::getOrCreateThread($user->id, $other->id);

        ChatMessage::create([
            'chat_thread_id' => $thread->id,
            'sender_id' => $other->id,
            'message' => 'Message non lu',
        ]);

        Sanctum::actingAs($user);

        $response = $this->postJson("/api/chat/threads/{$thread->id}/read");

        $response->assertOk()
            ->assertJsonPath('updated', 1);

        $this->assertDatabaseHas('chat_messages', [
            'chat_thread_id' => $thread->id,
            'sender_id' => $other->id,
            'is_read' => true,
        ]);
    }

    /**
     * GET /api/chat/threads/{thread} : interdit si non participant (403).
     */
    public function test_non_participant_cannot_access_thread(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $outsider = User::factory()->create();

        $thread = ChatThread::getOrCreateThread($user->id, $other->id);

        Sanctum::actingAs($outsider);

        $response = $this->getJson("/api/chat/threads/{$thread->id}");

        $response->assertStatus(403);
    }
}
