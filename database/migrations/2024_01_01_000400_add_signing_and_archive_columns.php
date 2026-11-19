<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->string('signed_file_path')->nullable()->after('file_path');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->longText('signature_image')->nullable();
        });

        Schema::table('archives', function (Blueprint $table) {
            $table->string('previous_status', 20)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('archives', function (Blueprint $table) {
            $table->dropColumn('previous_status');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('signature_image');
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->dropColumn('signed_file_path');
        });
    }
};
