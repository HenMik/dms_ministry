<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesDmsUsers;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use CreatesDmsUsers;
    use RefreshDatabase;

    private function admin(): User
    {
        $role = $this->roleWithPermissions('admin', ['*' => true], ['display_name' => 'Admin']);

        return User::factory()->create([
            'role_id' => $role->id,
            'is_admin' => true,
            'phone_number' => '0999000000',
        ]);
    }

    public function test_updating_user_with_empty_phone_number_succeeds(): void
    {
        $admin = $this->admin();
        $user = User::factory()->create([
            'phone_number' => '0888111222',
            'role_id' => $this->roleWithPermissions('viewer', ['documents.view' => true], ['display_name' => 'Viewer'])->id,
        ]);

        $this->actingAs($admin)
            ->from(route('users.index'))
            ->put(route('users.update', $user), [
                'first_name' => 'Pentest',
                'last_name' => 'Audit',
                'email' => $user->email,
                'phone_number' => null,
                'role_id' => $user->role_id,
                'is_approver' => false,
                'is_admin' => false,
                'is_active' => false,
            ])
            ->assertRedirect(route('users.index'))
            ->assertSessionHasNoErrors();

        $this->assertSame('', $user->fresh()->phone_number);
        $this->assertFalse($user->fresh()->is_active);
    }
}
