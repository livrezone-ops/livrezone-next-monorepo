<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('payments', 'period')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->enum('period', ['monthly', 'yearly'])->nullable()->after('subscription_type');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('payments', 'period')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->dropColumn('period');
            });
        }
    }
};
