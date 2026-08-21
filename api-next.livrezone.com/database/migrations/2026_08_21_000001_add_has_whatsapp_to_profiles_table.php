<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('profiles', function (Blueprint $table) {
            $table->boolean('has_whatsapp')
                ->default(true)
                ->after('phone')
                ->comment('Disponibilité sur WhatsApp (auto false si fixe 05, true si portable 06/07).');
        });
    }

    public function down(): void
    {
        Schema::table('profiles', function (Blueprint $table) {
            $table->dropColumn('has_whatsapp');
        });
    }
};
