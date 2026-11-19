<?php

namespace Tests\Feature;

use App\Models\DocumentCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesDmsUsers;
use Tests\TestCase;

class FolderVisibilityTest extends TestCase
{
    use CreatesDmsUsers;
    use RefreshDatabase;

    public function test_restricted_folder_is_hidden_from_non_members(): void
    {
        $finance = $this->department('FIN', ['name' => 'Finance']);
        $manager = $this->dmsUser('manager', [], $finance);
        $allowed = $this->dmsUser('viewer', [], $finance);
        $other = $this->dmsUser('viewer', [], $finance);

        $folder = DocumentCategory::create([
            'name' => 'Confidential',
            'description' => '',
        ]);
        $folder->syncDepartments([$finance->id]);
        $folder->visibleTo()->sync([$allowed->id]);

        $this->actingAs($allowed)
            ->get(route('documents.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->has('folders', 1)->where('folders.0.id', $folder->id));

        $this->actingAs($other)
            ->get(route('documents.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->has('folders', 0));

        $this->actingAs($other)
            ->get(route('documents.index', ['folder' => $folder->id]))
            ->assertForbidden();

        $this->actingAs($manager)
            ->get(route('documents.index', ['folder' => $folder->id]))
            ->assertOk();
    }

    public function test_folder_can_be_created_with_visible_people(): void
    {
        $finance = $this->department('FIN', ['name' => 'Finance']);
        $manager = $this->dmsUser('manager', [], $finance);
        $member = $this->dmsUser('viewer', [], $finance);

        $this->actingAs($manager)
            ->post(route('categories.store'), [
                'name' => 'Board only',
                'department_ids' => [$finance->id],
                'visible_to_ids' => [$member->id],
                'browse' => true,
            ])
            ->assertRedirect();

        $folder = DocumentCategory::where('name', 'Board only')->firstOrFail();
        $this->assertTrue($folder->visibleTo()->whereKey($member->id)->exists());
        $this->assertSame(1, $folder->visibleTo()->count());
        $this->assertEqualsCanonicalizing([$finance->id], $folder->departmentIds());
    }
}
