<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Concerns\CreatesDmsUsers;
use Tests\TestCase;

class UserPasswordResetTest extends TestCase
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

    public function test_admin_can_reset_user_password_to_default(): void
    {
        $admin = $this->admin();
        $user = User::factory()->create([
            'password' => 'OldSecret99!',
            'force_password_change' => false,
            'is_active' => false,
        ]);

        $this->actingAs($admin)
            ->from(route('users.index'))
            ->post(route('users.reset-password', $user))
            ->assertRedirect(route('users.index'))
            ->assertSessionHas('reset_password', 'ChangeMe123!')
            ->assertSessionHas('reset_password_user', $user->email);

        $user->refresh();

        $this->assertTrue(Hash::check('ChangeMe123!', $user->password));
        $this->assertTrue($user->force_password_change);
        $this->assertTrue($user->is_active);
        $this->assertNotNull($user->password_changed_at);
    }

    public function test_non_admin_cannot_reset_password(): void
    {
        $member = User::factory()->create([
            'role_id' => $this->roleWithPermissions('viewer', ['documents.view' => true], ['display_name' => 'Viewer'])->id,
            'is_admin' => false,
        ]);
        $target = User::factory()->create();

        $this->actingAs($member)
            ->post(route('users.reset-password', $target))
            ->assertForbidden();
    }
}
