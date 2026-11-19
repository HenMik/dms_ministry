<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('archives', function (Blueprint $table) {
            $table->id();
            $table->morphs('archivable');
            $table->foreignId('archived_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('archived_at')->useCurrent();
            $table->text('reason')->default('');
            $table->boolean('restricted_access')->default(false);
            $table->timestamps();
        });

        Schema::create('archive_allowed_users', function (Blueprint $table) {
            $table->id();
            $table->foreignId('archive_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unique(['archive_id', 'user_id']);
        });

        Schema::create('search_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('query', 500);
            $table->unsignedInteger('results_count')->default(0);
            $table->json('search_filters')->nullable();
            $table->timestamp('searched_at')->useCurrent();
        });

        Schema::create('app_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('notification_type', 50);
            $table->string('title', 200);
            $table->text('message');
            $table->nullableMorphs('related');
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->boolean('sent_email')->default(false);
            $table->boolean('sent_push')->default(false);
            $table->timestamps();
        });

        Schema::create('push_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('endpoint', 500);
            $table->text('p256dh_key');
            $table->text('auth_key');
            $table->text('user_agent')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'endpoint']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_subscriptions');
        Schema::dropIfExists('app_notifications');
        Schema::dropIfExists('search_histories');
        Schema::dropIfExists('archive_allowed_users');
        Schema::dropIfExists('archives');
    }
};
