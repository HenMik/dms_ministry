<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100)->unique();
            $table->text('description')->default('');
            $table->foreignId('parent_id')->nullable()->constrained('document_categories')->cascadeOnDelete();
            $table->timestamps();
        });

        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->string('title', 200);
            $table->text('description')->default('');
            $table->foreignId('category_id')->nullable()->constrained('document_categories')->nullOnDelete();
            $table->string('file_path');
            $table->unsignedBigInteger('file_size')->nullable();
            $table->string('mime_type', 100)->default('');
            $table->unsignedInteger('version')->default(1);
            $table->foreignId('parent_version_id')->nullable()->constrained('documents')->nullOnDelete();
            $table->string('status', 20)->default('DRAFT');
            $table->boolean('encrypted')->default(false);
            $table->string('encryption_key')->default('');
            $table->timestamp('access_expires_at')->nullable();
            $table->boolean('watermark_enabled')->default(false);
            $table->boolean('requires_approval')->default(false);
            $table->foreignId('uploaded_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('searchable_content')->default('');
            $table->timestamps();
        });

        Schema::create('document_visible_to', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unique(['document_id', 'user_id']);
        });

        Schema::create('document_pending_approvers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unique(['document_id', 'user_id']);
        });

        Schema::create('document_approved_by', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('approved_at')->useCurrent();
            $table->unique(['document_id', 'user_id']);
        });

        Schema::create('document_annotations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('annotation_type', 20);
            $table->unsignedInteger('page_number')->nullable();
            $table->json('coordinates')->nullable();
            $table->text('content')->default('');
            $table->string('color', 7)->default('#FFFF00');
            $table->boolean('resolved')->default(false);
            $table->foreignId('resolved_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
        });

        Schema::create('document_signatures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('signature_type', 20)->default('INTERNAL');
            $table->json('signature_data')->nullable();
            $table->timestamp('signed_at')->useCurrent();
            $table->boolean('verified')->default(false);
            $table->text('verification_certificate')->default('');
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->unique(['document_id', 'user_id']);
            $table->timestamps();
        });

        Schema::create('document_access_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 50);
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('accessed_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_access_logs');
        Schema::dropIfExists('document_signatures');
        Schema::dropIfExists('document_annotations');
        Schema::dropIfExists('document_approved_by');
        Schema::dropIfExists('document_pending_approvers');
        Schema::dropIfExists('document_visible_to');
        Schema::dropIfExists('documents');
        Schema::dropIfExists('document_categories');
    }
};
