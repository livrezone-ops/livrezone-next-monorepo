<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('payments', 'discount_code')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->string('discount_code')->nullable()->after('period');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('payments', 'discount_code')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->dropColumn('discount_code');
            });
        }
    }
};
