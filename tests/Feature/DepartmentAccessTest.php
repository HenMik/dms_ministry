<?php

namespace Tests\Feature;

use App\Models\Document;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CreatesDmsUsers;
use Tests\TestCase;

class DepartmentAccessTest extends TestCase
{
    use CreatesDmsUsers;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    public function test_users_cannot_view_documents_outside_their_departments(): void
    {
        $finance = $this->department('FIN', ['name' => 'Finance']);
        $hr = $this->department('HR', ['name' => 'HR']);

        $financeUser = $this->dmsUser('contributor', [], $finance);
        $hrUser = $this->dmsUser('viewer', [], $hr);

        $document = Document::create([
            'department_id' => $finance->id,
            'title' => 'Finance only',
            'description' => '',
            'file_path' => UploadedFile::fake()->create('fin.pdf', 10, 'application/pdf')->store('documents', 'local'),
            'file_size' => 10,
            'mime_type' => 'application/pdf',
            'status' => 'DRAFT',
            'uploaded_by_id' => $financeUser->id,
        ]);

        $this->actingAs($financeUser)->get(route('documents.show', $document))->assertOk();
        $this->actingAs($hrUser)->get(route('documents.show', $document))->assertForbidden();
    }

    public function test_admin_can_create_and_update_roles(): void
    {
        $admin = $this->dmsUser('admin', ['is_admin' => true]);

        $this->actingAs($admin)
            ->post(route('roles.store'), [
                'name' => 'records_officer',
                'display_name' => 'Records Officer',
                'description' => 'Handles filing',
                'permissions' => [
                    'documents.view' => true,
                    'documents.create' => true,
                    'archive.view' => true,
                ],
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('roles', ['name' => 'records_officer', 'display_name' => 'Records Officer']);
    }

    public function test_department_manager_can_create_department(): void
    {
        $admin = $this->dmsUser('admin', ['is_admin' => true]);

        $this->actingAs($admin)
            ->post(route('departments.store'), [
                'name' => 'Operations',
                'code' => 'OPS',
                'description' => 'Ops team',
                'is_active' => true,
                'user_ids' => [],
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('departments', ['code' => 'OPS', 'name' => 'Operations']);
    }
}
