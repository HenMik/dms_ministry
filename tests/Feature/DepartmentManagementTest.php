<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesDmsUsers;
use Tests\TestCase;

class DepartmentManagementTest extends TestCase
{
    use CreatesDmsUsers;
    use RefreshDatabase;

    public function test_index_includes_organogram_and_list_actions(): void
    {
        $ministry = $this->department('MOTI', ['name' => 'Ministry']);
        $finance = $this->department('FIN', ['name' => 'Finance', 'parent_id' => $ministry->id]);
        $admin = $this->dmsUser('admin', ['is_admin' => true], $ministry);

        $this->actingAs($admin)
            ->get(route('departments.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Departments/Index')
                ->has('organogram', 1)
                ->where('organogram.0.id', $ministry->id)
                ->where('organogram.0.children.0.id', $finance->id)
                ->has('departments', 2));
    }

    public function test_manager_can_view_and_edit_department(): void
    {
        $finance = $this->department('FIN', ['name' => 'Finance']);
        $admin = $this->dmsUser('admin', ['is_admin' => true], $finance);
        $member = $this->dmsUser('viewer', [], $finance);

        $this->actingAs($admin)
            ->get(route('departments.show', $finance))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Departments/Show')
                ->where('department.id', $finance->id)
                ->where('department.code', 'FIN')
                ->has('department.members'));

        $this->actingAs($admin)
            ->get(route('departments.edit', $finance))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Departments/Edit')
                ->where('department.id', $finance->id));

        $this->actingAs($admin)
            ->put(route('departments.update', $finance), [
                'name' => 'Finance & Accounts',
                'code' => 'FIN',
                'description' => 'Updated',
                'is_active' => true,
                'sort_order' => 1,
                'user_ids' => [$member->id, $admin->id],
                'primary_user_id' => $admin->id,
            ])
            ->assertRedirect(route('departments.show', $finance));

        $this->assertDatabaseHas('departments', [
            'id' => $finance->id,
            'name' => 'Finance & Accounts',
            'description' => 'Updated',
        ]);
    }

    public function test_department_cannot_be_parented_under_its_descendant(): void
    {
        $ministry = $this->department('MOTI', ['name' => 'Ministry']);
        $finance = $this->department('FIN', ['name' => 'Finance', 'parent_id' => $ministry->id]);
        $admin = $this->dmsUser('admin', ['is_admin' => true], $ministry);

        $this->actingAs($admin)
            ->from(route('departments.edit', $ministry))
            ->put(route('departments.update', $ministry), [
                'name' => 'Ministry',
                'code' => 'MOTI',
                'parent_id' => $finance->id,
                'description' => '',
                'is_active' => true,
                'sort_order' => 0,
                'user_ids' => [],
            ])
            ->assertRedirect(route('departments.edit', $ministry))
            ->assertSessionHasErrors('parent_id');

        $this->assertNull($ministry->fresh()->parent_id);
    }

    public function test_viewer_cannot_manage_departments(): void
    {
        $finance = $this->department('FIN', ['name' => 'Finance']);
        $viewer = $this->dmsUser('viewer', [], $finance);

        $this->actingAs($viewer)->get(route('departments.index'))->assertForbidden();
        $this->actingAs($viewer)->get(route('departments.show', $finance))->assertForbidden();
        $this->actingAs($viewer)->get(route('departments.edit', $finance))->assertForbidden();
    }
}
