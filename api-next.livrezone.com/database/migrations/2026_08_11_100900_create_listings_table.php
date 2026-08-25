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
        Schema::create('listings', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->enum('listing_type', ['single', 'pack'])->default('single');

            $table->foreignId('book_id')
                ->nullable()
                ->constrained('books')
                ->nullOnDelete();

            $table->string('isbn_13', 13)->nullable();

            $table->string('title', 255);
            $table->text('description')->nullable();
            
            // État du livre (neuf ou occasion)
            $table->enum('book_condition', ['neuf', 'occas']);

            $table->decimal('price', 10, 2);
            $table->decimal('discount_price', 10, 2)->nullable();

            $table->decimal('pack_price', 10, 2)->nullable();
            $table->decimal('pack_discount_price', 10, 2)->nullable();

            $table->char('currency', 3)->default('MAD');
            $table->unsignedInteger('quantity')->default(1);

            $table->string('cover_path', 255)->nullable();
            $table->text('cover_source_url')->nullable();

            $table->foreignId('category_id')
                ->nullable()
                ->constrained('categories')
                ->nullOnDelete();

            $table->foreignId('level_id')
                ->nullable()
                ->constrained('levels')
                ->nullOnDelete();

            $table->foreignId('subject_id')
                ->nullable()
                ->constrained('subjects')
                ->nullOnDelete();

            $table->foreignId('language_id')
                ->nullable()
                ->constrained('languages')
                ->nullOnDelete();

            $table->enum('status', [
                'pending_admin',
                'published',
                'rejected',
                'deleted',
                'sold',
                'active',
                'archived',
                'hidden',
                'expired',
            ])->default('pending_admin');

            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();

            $table->foreignId('reviewed_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->text('moderation_note')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamp('deleted_at')->nullable();

            $table->timestamps();

            $table->index('isbn_13');
            $table->index('book_condition');
            $table->index(['user_id', 'status']);
            $table->index(['status', 'published_at']);
            $table->index(['listing_type', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('listings');
    }
};
