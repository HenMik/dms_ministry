<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesDmsUsers;
use Tests\TestCase;

class AdminSignatureTest extends TestCase
{
    use CreatesDmsUsers;
    use RefreshDatabase;

    public function test_users_cannot_update_their_own_signature(): void
    {
        $user = $this->dmsUser('contributor');

        $this->actingAs($user)
            ->put(route('profile.signature.update'), [
                'signature_image' => 'data:image/png;base64,aaaa',
            ])
            ->assertForbidden();
    }

    public function test_admin_can_assign_signature_to_a_user(): void
    {
        $admin = $this->dmsUser('admin', ['is_admin' => true]);
        $user = $this->dmsUser('contributor');
        $image = 'data:image/png;base64,'.base64_encode('signature');

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
                'signature_image' => $image,
            ])
            ->assertRedirect();

        $this->assertSame($image, $user->fresh()->signature_image);
    }
}
