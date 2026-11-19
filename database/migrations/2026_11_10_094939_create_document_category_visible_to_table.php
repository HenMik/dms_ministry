<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_category_visible_to', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_category_id')->constrained('document_categories')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unique(['document_category_id', 'user_id'], 'category_visible_user_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_category_visible_to');
    }
};
