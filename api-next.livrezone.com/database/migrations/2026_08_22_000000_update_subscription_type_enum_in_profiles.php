<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE profiles MODIFY COLUMN subscription_type ENUM('free', 'pro', 'premium') DEFAULT 'free'");
    }

    public function down(): void
    {
        DB::table('profiles')->where('subscription_type', 'pro')->update(['subscription_type' => 'free']);
        DB::statement("ALTER TABLE profiles MODIFY COLUMN subscription_type ENUM('free', 'premium') DEFAULT 'free'");
    }
};
