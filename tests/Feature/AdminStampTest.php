<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesDmsUsers;
use Tests\TestCase;

class AdminStampTest extends TestCase
{
    use CreatesDmsUsers;
    use RefreshDatabase;

    public function test_users_cannot_update_their_own_stamp(): void
    {
        $user = $this->dmsUser('contributor');

        $this->actingAs($user)
            ->put(route('profile.stamp.update'), [
                'stamp_image' => 'data:image/png;base64,aaaa',
            ])
            ->assertForbidden();
    }

    public function test_users_cannot_remove_their_own_stamp(): void
    {
        $user = $this->dmsUser('contributor');

        $this->actingAs($user)
            ->delete(route('profile.stamp.destroy'))
            ->assertForbidden();
    }

    public function test_admin_can_assign_stamp_to_a_user(): void
    {
        $admin = $this->dmsUser('admin', ['is_admin' => true]);
        $user = $this->dmsUser('contributor');
        $image = 'data:image/png;base64,'.base64_encode('stamp');

        $this->actingAs($admin)
            ->put(route('users.update', $user), [
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'phone_number' => $user->phone_number,
                'role_id' => $user->role_id,
                'is_approver' => false,
                'is_admin' => false,
                'is_active' => true,
                'department_ids' => $user->departmentIds(),
                'stamp_image' => $image,
            ])
            ->assertRedirect();

        $this->assertSame($image, $user->fresh()->stamp_image);
    }

    public function test_admin_can_clear_stamp_from_a_user(): void
    {
        $admin = $this->dmsUser('admin', ['is_admin' => true]);
        $user = $this->dmsUser('contributor', [
            'stamp_image' => 'data:image/png;base64,'.base64_encode('stamp'),
        ]);

        $this->actingAs($admin)
            ->put(route('users.update', $user), [
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'phone_number' => $user->phone_number,
                'role_id' => $user->role_id,
                'is_approver' => false,
                'is_admin' => false,
                'is_active' => true,
                'department_ids' => $user->departmentIds(),
                'clear_stamp' => true,
            ])
            ->assertRedirect();

        $this->assertNull($user->fresh()->stamp_image);
    }
}
