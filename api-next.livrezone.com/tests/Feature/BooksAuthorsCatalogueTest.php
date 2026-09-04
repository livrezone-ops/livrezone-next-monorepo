<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Services\BookCatalogueService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Catalogue : index des auteurs (agrégat du champ JSON authors) + fiche auteur
 * + enrichissement du payload public (active_listings_count, prix indicatif).
 */
class BooksAuthorsCatalogueTest extends TestCase
{
    use RefreshDatabase;

    private function createBook(array $attributes = []): Book
    {
        return Book::withoutSyncingToSearch(fn () => Book::create(array_merge([
            'title' => 'Livre de test',
            'authors' => ['Victor Hugo'],
        ], $attributes)));
    }

    public function test_authors_index_aggregates_counts_and_slugs(): void
    {
        // Index auteurs DÉSACTIVÉ (incident 03/09 : le scan chunk(1000) des
        // ~700k livres, lancé en parallèle par les workers, saturait MariaDB
        // et rendait le site injoignable). À réactiver avec l'agrégat SQL
        // (JSON_TABLE ou table book_authors dénormalisée).
        $this->markTestSkipped('Index auteurs désactivé (incident 03/09) — refonte SQL à faire.');

        $this->createBook(['authors' => ['Victor Hugo']]);
        $this->createBook(['authors' => ['Victor Hugo', 'Émile Zola']]);
        $this->createBook(['title' => 'Sans auteur', 'authors' => null]);

        $response = $this->getJson('/api/books/authors');

        $response->assertOk()
            ->assertJsonStructure([
                'data' => [['name', 'slug', 'books_count', 'cover_url']],
                'total',
                'total_authors',
                'current_page',
                'last_page',
                'letters',
            ]);

        $this->assertSame(2, $response->json('total_authors'));

        $hugo = collect($response->json('data'))->firstWhere('slug', 'victor-hugo');
        $this->assertNotNull($hugo);
        $this->assertSame(2, $hugo['books_count']);

        $zola = collect($response->json('data'))->firstWhere('slug', 'emile-zola');
        $this->assertNotNull($zola, 'Le slug doit être translittéré (É → e).');
    }

    public function test_authors_index_filters_by_letter_and_sorts_top(): void
    {
        $this->markTestSkipped('Index auteurs désactivé (incident 03/09) — refonte SQL à faire.');

        $this->createBook(['authors' => ['Victor Hugo']]);
        $this->createBook(['authors' => ['Zola']]);
        $this->createBook(['authors' => ['Zola']]);

        $byLetter = $this->getJson('/api/books/authors?letter=V');
        $byLetter->assertOk();
        $this->assertSame(1, $byLetter->json('total'));
        $this->assertSame('Victor Hugo', $byLetter->json('data.0.name'));

        $top = $this->getJson('/api/books/authors?sort=top&limit=2');
        $top->assertOk();
        $this->assertSame('Zola', $top->json('data.0.name'));
        $this->assertSame(2, $top->json('data.0.books_count'));
    }

    public function test_author_show_returns_books_of_the_author(): void
    {
        $this->markTestSkipped('Index auteurs désactivé (incident 03/09) — refonte SQL à faire.');

        $this->createBook(['title' => 'Les Misérables', 'authors' => ['Victor Hugo']]);
        $this->createBook(['title' => 'Germinal', 'authors' => ['Zola']]);

        $response = $this->getJson('/api/books/authors/victor-hugo');

        $response->assertOk()
            ->assertJsonPath('author.name', 'Victor Hugo')
            ->assertJsonPath('author.slug', 'victor-hugo')
            ->assertJsonPath('total', 1);

        $this->assertSame('Les Misérables', $response->json('books.0.title'));
    }

    public function test_author_show_returns_404_on_unknown_slug(): void
    {
        $this->getJson('/api/books/authors/auteur-inconnu')->assertStatus(404);
    }

    public function test_format_book_exposes_listings_count_and_indicative_price(): void
    {
        $book = $this->createBook([
            'title' => 'Titre test',
            'indicative_price' => 149.9,
            'indicative_price_currency' => 'MAD',
        ]);

        $book = $book->fresh();
        $book->setRelation('defaultCategory', null);
        $book->setRelation('language', null);
        $book->setRelation('defaultLevel', null);
        $book->active_listings_count = 0;

        $payload = app(BookCatalogueService::class)->formatBook($book);

        $this->assertArrayHasKey('active_listings_count', $payload);
        $this->assertArrayHasKey('indicative_price', $payload);
        $this->assertArrayHasKey('indicative_price_currency', $payload);
        $this->assertSame(0, $payload['active_listings_count']);
        $this->assertSame(149.9, $payload['indicative_price']);
        $this->assertSame('MAD', $payload['indicative_price_currency']);
    }
}
