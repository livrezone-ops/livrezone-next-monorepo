<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('books', function (Blueprint $table) {
            $table->id();

            $table->string('isbn_13', 13)->nullable()->unique();
            $table->string('title', 255);
            $table->string('normalized_title', 255)->nullable();

            $table->json('authors')->nullable();
            $table->string('publisher', 255)->nullable();
            $table->longText('description')->nullable();

            $table->date('publication_date')->nullable();

            $table->foreignId('language_id')
                ->nullable()
                ->constrained('languages')
                ->nullOnDelete();

            $table->unsignedInteger('page_count')->nullable();

            $table->decimal('indicative_price', 10, 2)->nullable();
            $table->char('indicative_price_currency', 3)->default('MAD');

            $table->string('cover_path', 255)->nullable();
            $table->text('cover_source_url')->nullable();

            $table->string('metadata_source', 100)->nullable();
            $table->json('metadata_sources')->nullable();

            $table->foreignId('default_category_id')
                ->nullable()
                ->constrained('categories')
                ->nullOnDelete();

            $table->foreignId('default_level_id')
                ->nullable()
                ->constrained('levels')
                ->nullOnDelete();

            $table->foreignId('default_subject_id')
                ->nullable()
                ->constrained('subjects')
                ->nullOnDelete();

            $table->string('breadcrumb', 255)->nullable();
            $table->timestamp('last_verified_at')->nullable();

            $table->timestamps();

            $table->index('normalized_title');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('books');
    }
};
