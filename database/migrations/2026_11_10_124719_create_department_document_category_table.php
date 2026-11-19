<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('department_document_category', function (Blueprint $table) {
            $table->id();
            $table->foreignId('department_id')->constrained()->cascadeOnDelete();
            $table->foreignId('document_category_id')->constrained('document_categories')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['department_id', 'document_category_id'], 'dept_doc_category_unique');
        });

        if (Schema::hasColumn('document_categories', 'department_id')) {
            $rows = DB::table('document_categories')
                ->whereNotNull('department_id')
                ->get(['id', 'department_id']);

            $now = now();
            foreach ($rows as $row) {
                DB::table('department_document_category')->insert([
                    'department_id' => $row->department_id,
                    'document_category_id' => $row->id,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            Schema::table('document_categories', function (Blueprint $table) {
                $table->dropConstrainedForeignId('department_id');
            });
        }
    }

    public function down(): void
    {
        Schema::table('document_categories', function (Blueprint $table) {
            $table->foreignId('department_id')->nullable()->after('id')->constrained('departments')->nullOnDelete();
        });

        $rows = DB::table('department_document_category')
            ->orderBy('id')
            ->get(['department_id', 'document_category_id']);

        $assigned = [];
        foreach ($rows as $row) {
            if (isset($assigned[$row->document_category_id])) {
                continue;
            }

            DB::table('document_categories')
                ->where('id', $row->document_category_id)
                ->update(['department_id' => $row->department_id]);

            $assigned[$row->document_category_id] = true;
        }

        Schema::dropIfExists('department_document_category');
    }
};
