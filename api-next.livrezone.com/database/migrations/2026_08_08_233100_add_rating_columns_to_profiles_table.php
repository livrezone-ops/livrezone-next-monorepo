<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('profiles', function (Blueprint $table) {
            $table->decimal('rating_average', 3, 2)->default(0.00)->after('adresse');
            $table->unsignedInteger('rating_count')->default(0)->after('rating_average');
        });
    }

    public function down(): void
    {
        Schema::table('profiles', function (Blueprint $table) {
            $table->dropColumn(['rating_average', 'rating_count']);
        });
    }
};
