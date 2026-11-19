<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\DocumentCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CreatesDmsUsers;
use Tests\TestCase;

class FolderDepartmentFlexibilityTest extends TestCase
{
    use CreatesDmsUsers;
    use RefreshDatabase;

    public function test_folder_can_belong_to_multiple_departments(): void
    {
        $finance = $this->department('FIN', ['name' => 'Finance']);
        $trade = $this->department('TRD', ['name' => 'Trade']);
        $manager = $this->dmsUser('manager', [], $finance);

        $this->actingAs($manager)
            ->post(route('categories.store'), [
                'name' => 'Shared Policies',
                'department_ids' => [$finance->id, $trade->id],
                'browse' => true,
            ])
            ->assertRedirect();

        $folder = DocumentCategory::where('name', 'Shared Policies')->firstOrFail();

        $this->assertEqualsCanonicalizing(
            [$finance->id, $trade->id],
            $folder->departmentIds()
        );
    }

    public function test_document_department_can_differ_from_folder_departments(): void
    {
        Storage::fake('local');

        $finance = $this->department('FIN', ['name' => 'Finance']);
        $trade = $this->department('TRD', ['name' => 'Trade']);
        $uploader = $this->dmsUser('manager', [], $finance);
        $uploader->departments()->sync([
            $finance->id => ['is_primary' => true],
            $trade->id => ['is_primary' => false],
        ]);

        $folder = DocumentCategory::create(['name' => 'Shared Inbox', 'description' => '']);
        $folder->syncDepartments([$finance->id, $trade->id]);

        $this->actingAs($uploader)
            ->post(route('documents.store'), [
                'title' => 'Trade memo',
                'description' => '',
                'department_id' => $trade->id,
                'category_id' => $folder->id,
                'file' => UploadedFile::fake()->create('memo.pdf', 120, 'application/pdf'),
                'requires_approval' => false,
                'visible_to_ids' => [],
                'pending_approver_ids' => [],
            ])
            ->assertRedirect();

        $document = Document::where('title', 'Trade memo')->firstOrFail();

        $this->assertSame($folder->id, $document->category_id);
        $this->assertSame($trade->id, $document->department_id);
        $this->assertEqualsCanonicalizing([$finance->id, $trade->id], $folder->fresh()->departmentIds());
    }

    public function test_open_folder_is_visible_across_departments(): void
    {
        $finance = $this->department('FIN', ['name' => 'Finance']);
        $trade = $this->department('TRD', ['name' => 'Trade']);
        $financeUser = $this->dmsUser('viewer', [], $finance);
        $tradeUser = $this->dmsUser('viewer', [], $trade);

        $folder = DocumentCategory::create(['name' => 'Open Archive', 'description' => '']);

        $this->actingAs($financeUser)
            ->get(route('documents.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->has('folders', 1)->where('folders.0.id', $folder->id));

        $this->actingAs($tradeUser)
            ->get(route('documents.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->has('folders', 1)->where('folders.0.id', $folder->id));
    }

    public function test_categories_admin_index_redirects_to_documents(): void
    {
        $finance = $this->department('FIN', ['name' => 'Finance']);
        $manager = $this->dmsUser('manager', [], $finance);

        $this->actingAs($manager)
            ->get(route('categories.index'))
            ->assertRedirect(route('documents.index'));
    }
}
