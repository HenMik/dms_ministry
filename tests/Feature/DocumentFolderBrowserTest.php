<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\DocumentCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CreatesDmsUsers;
use Tests\TestCase;

class DocumentFolderBrowserTest extends TestCase
{
    use CreatesDmsUsers;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    private function user(string $role = 'contributor', array $attributes = []): User
    {
        return $this->dmsUser($role, $attributes);
    }

    public function test_documents_index_lists_folders_and_documents_in_current_folder(): void
    {
        $user = $this->user();
        $departmentId = $user->departments()->first()->id;
        $policies = DocumentCategory::create(['name' => 'Policies']);
        $policies->syncDepartments([$departmentId]);
        $nested = DocumentCategory::create(['name' => 'Risk', 'parent_id' => $policies->id]);
        $nested->syncDepartments([$departmentId]);

        $inRoot = Document::create([
            'department_id' => $departmentId,
            'title' => 'Root note',
            'description' => '',
            'file_path' => 'documents/root.pdf',
            'mime_type' => 'application/pdf',
            'status' => 'DRAFT',
            'uploaded_by_id' => $user->id,
            'category_id' => null,
        ]);
        $inPolicies = Document::create([
            'department_id' => $departmentId,
            'title' => 'Policy A',
            'description' => '',
            'file_path' => 'documents/policy.pdf',
            'mime_type' => 'application/pdf',
            'status' => 'DRAFT',
            'uploaded_by_id' => $user->id,
            'category_id' => $policies->id,
        ]);

        $this->actingAs($user)->get(route('documents.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Documents/Index')
                ->where('viewMode', 'folder')
                ->has('folders', 1)
                ->where('folders.0.name', 'Policies')
                ->has('documents.data', 1)
                ->where('documents.data.0.id', $inRoot->id));

        $this->actingAs($user)->get(route('documents.index', ['folder' => $policies->id]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('currentFolder.id', $policies->id)
                ->has('folders', 1)
                ->where('folders.0.id', $nested->id)
                ->has('documents.data', 1)
                ->where('documents.data.0.id', $inPolicies->id));
    }

    public function test_user_can_create_folder_and_upload_into_it(): void
    {
        $user = $this->user();
        $departmentId = $user->departments()->first()->id;
        $parent = DocumentCategory::create(['name' => 'Board Papers']);
        $parent->syncDepartments([$departmentId]);

        $this->actingAs($user)->post(route('categories.store'), [
            'name' => 'Q3 2026',
            'parent_id' => $parent->id,
            'department_ids' => [$departmentId],
            'browse' => true,
        ])->assertRedirect();

        $folder = DocumentCategory::where('name', 'Q3 2026')->firstOrFail();
        $this->assertSame($parent->id, $folder->parent_id);

        $this->actingAs($user)->post(route('documents.store'), [
            'title' => 'Agenda',
            'department_id' => $departmentId,
            'category_id' => $folder->id,
            'file' => UploadedFile::fake()->create('agenda.pdf', 100, 'application/pdf'),
            'visible_to_ids' => [],
        ])->assertRedirect(route('documents.index', ['folder' => $folder->id]));

        $this->assertDatabaseHas('documents', [
            'title' => 'Agenda',
            'category_id' => $folder->id,
            'uploaded_by_id' => $user->id,
        ]);
    }

    public function test_json_endpoint_creates_nested_folders_for_upload_flow(): void
    {
        $user = $this->user();
        $parent = DocumentCategory::create(['name' => 'Policies']);

        $response = $this->actingAs($user)->postJson(route('categories.store'), [
            'name' => 'AML',
            'parent_id' => $parent->id,
            'json' => true,
        ]);

        $response->assertOk()
            ->assertJsonPath('folder.name', 'AML')
            ->assertJsonPath('folder.parent_id', $parent->id);

        $nestedId = $response->json('folder.id');

        $deeper = $this->actingAs($user)->postJson(route('categories.store'), [
            'name' => '2026 updates',
            'parent_id' => $nestedId,
            'json' => true,
        ]);

        $deeper->assertOk()
            ->assertJsonPath('folder.parent_id', $nestedId);

        $this->assertTrue(
            collect($deeper->json('categories'))->contains(fn ($c) => $c['name'] === '2026 updates')
        );
    }

    public function test_user_can_move_document_between_folders(): void
    {
        $user = $this->user();
        $departmentId = $user->departments()->first()->id;
        $from = DocumentCategory::create(['name' => 'From']);
        $from->syncDepartments([$departmentId]);
        $to = DocumentCategory::create(['name' => 'To']);
        $to->syncDepartments([$departmentId]);
        $document = Document::create([
            'department_id' => $departmentId,
            'title' => 'Travel policy',
            'description' => '',
            'file_path' => 'documents/travel.pdf',
            'mime_type' => 'application/pdf',
            'status' => 'DRAFT',
            'uploaded_by_id' => $user->id,
            'category_id' => $from->id,
        ]);

        $this->actingAs($user)
            ->post(route('documents.move', $document), ['category_id' => $to->id])
            ->assertRedirect();

        $this->assertSame($to->id, $document->fresh()->category_id);
    }

    public function test_user_can_delete_folder_from_browser(): void
    {
        $user = $this->user();
        $parent = DocumentCategory::create(['name' => 'Board Papers']);
        $child = DocumentCategory::create(['name' => 'Old draft', 'parent_id' => $parent->id]);

        $this->actingAs($user)
            ->from(route('documents.index', ['folder' => $parent->id]))
            ->delete(route('categories.destroy', $child), ['browse' => true])
            ->assertRedirect(route('documents.index', ['folder' => $parent->id]));

        $this->assertDatabaseMissing('document_categories', ['id' => $child->id]);
    }

    public function test_folder_browser_hides_documents_not_visible_to_member(): void
    {
        $finance = $this->department('FIN');
        $secretary = $this->dmsUser('contributor', [], $finance);
        $member = $this->dmsUser('approver', [], $finance);
        $departmentId = $finance->id;
        $folder = DocumentCategory::create(['name' => 'Confidential']);
        $folder->syncDepartments([$departmentId]);

        $shared = Document::create([
            'department_id' => $departmentId,
            'title' => 'Shared',
            'description' => '',
            'file_path' => 'documents/shared.pdf',
            'mime_type' => 'application/pdf',
            'status' => 'APPROVED',
            'uploaded_by_id' => $secretary->id,
            'category_id' => $folder->id,
        ]);
        $shared->visibleTo()->attach($member->id);

        $hidden = Document::create([
            'department_id' => $departmentId,
            'title' => 'Hidden',
            'description' => '',
            'file_path' => 'documents/hidden.pdf',
            'mime_type' => 'application/pdf',
            'status' => 'APPROVED',
            'uploaded_by_id' => $secretary->id,
            'category_id' => $folder->id,
        ]);
        $hidden->visibleTo()->attach($secretary->id);

        $this->actingAs($member)->get(route('documents.index', ['folder' => $folder->id]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('documents.data', 1)
                ->where('documents.data.0.id', $shared->id));
    }
}
