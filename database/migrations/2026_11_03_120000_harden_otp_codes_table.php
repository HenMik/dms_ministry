<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('otp_codes', function (Blueprint $table) {
            $table->string('phone', 20)->nullable()->after('code');
            $table->unsignedTinyInteger('attempts')->default(0)->after('used');
            $table->timestamp('last_sent_at')->nullable()->after('attempts');
        });

        // Widen hashed code column without doctrine/dbal.
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE otp_codes MODIFY code VARCHAR(64) NOT NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE otp_codes ALTER COLUMN code TYPE VARCHAR(64)');
        }
        // sqlite ignores length; hashed codes fit fine.
    }

    public function down(): void
    {
        Schema::table('otp_codes', function (Blueprint $table) {
            $table->dropColumn(['phone', 'attempts', 'last_sent_at']);
        });
    }
};
