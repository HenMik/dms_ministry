<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->timestamp('approval_started_at')->nullable()->after('requires_approval');
            $table->timestamp('approval_completed_at')->nullable()->after('approval_started_at');
        });

        Schema::table('document_pending_approvers', function (Blueprint $table) {
            $table->unsignedInteger('sort_order')->default(0)->after('user_id');
            $table->string('status', 20)->default('waiting')->after('sort_order');
            $table->timestamp('acted_at')->nullable()->after('status');
        });

        // Existing pending rows become "current" for the first per document, waiting for the rest.
        $documentIds = DB::table('document_pending_approvers')->distinct()->pluck('document_id');
        foreach ($documentIds as $documentId) {
            $rows = DB::table('document_pending_approvers')
                ->where('document_id', $documentId)
                ->orderBy('id')
                ->get(['id']);

            foreach ($rows as $index => $row) {
                DB::table('document_pending_approvers')->where('id', $row->id)->update([
                    'sort_order' => $index,
                    'status' => $index === 0 ? 'current' : 'waiting',
                ]);
            }

            DB::table('documents')->where('id', $documentId)->whereNull('approval_started_at')->update([
                'approval_started_at' => now(),
            ]);
        }

        // Promote historical approvals into ordered rows when missing.
        $approved = DB::table('document_approved_by')->orderBy('approved_at')->get();
        foreach ($approved->groupBy('document_id') as $documentId => $rows) {
            $maxOrder = (int) DB::table('document_pending_approvers')
                ->where('document_id', $documentId)
                ->max('sort_order');

            foreach ($rows->values() as $index => $row) {
                $exists = DB::table('document_pending_approvers')
                    ->where('document_id', $documentId)
                    ->where('user_id', $row->user_id)
                    ->exists();

                if ($exists) {
                    DB::table('document_pending_approvers')
                        ->where('document_id', $documentId)
                        ->where('user_id', $row->user_id)
                        ->update([
                            'status' => 'approved',
                            'acted_at' => $row->approved_at,
                        ]);

                    continue;
                }

                DB::table('document_pending_approvers')->insert([
                    'document_id' => $documentId,
                    'user_id' => $row->user_id,
                    'sort_order' => $maxOrder + $index + 1,
                    'status' => 'approved',
                    'acted_at' => $row->approved_at,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('document_pending_approvers', function (Blueprint $table) {
            $table->dropColumn(['sort_order', 'status', 'acted_at']);
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->dropColumn(['approval_started_at', 'approval_completed_at']);
        });
    }
};
