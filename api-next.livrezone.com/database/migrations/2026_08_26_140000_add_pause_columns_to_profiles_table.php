<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('profiles', function (Blueprint $table) {
            if (! Schema::hasColumn('profiles', 'paused_from_type')) {
                $table->string('paused_from_type')->nullable()->after('subscription_type');
            }
            if (! Schema::hasColumn('profiles', 'paused_at')) {
                $table->timestamp('paused_at')->nullable()->after('paused_from_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('profiles', function (Blueprint $table) {
            if (Schema::hasColumn('profiles', 'paused_at')) {
                $table->dropColumn('paused_at');
            }
            if (Schema::hasColumn('profiles', 'paused_from_type')) {
                $table->dropColumn('paused_from_type');
            }
        });
    }
};
