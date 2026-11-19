<?php

namespace App\Http\Middleware;

use App\Models\Organization;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        $user = $request->user();
        if ($user) {
            $user->loadMissing(['role', 'departments:id,name,code']);
        }

        $organization = Organization::current();

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'first_name' => $user->first_name,
                    'last_name' => $user->last_name,
                    'email' => $user->email,
                    'phone_number' => $user->phone_number,
                    'is_admin' => $user->isAdmin(),
                    'is_approver' => $user->is_approver,
                    'role' => $user->role,
                    'force_password_change' => $user->mustChangePassword(),
                    'can_manage_users' => $user->canManageUsers(),
                    'can_manage_roles' => $user->canPerm('roles.manage'),
                    'can_manage_departments' => $user->canPerm('departments.manage'),
                    'can_manage_folders' => $user->canPerm('folders.manage'),
                    'can_manage_settings' => $user->canPerm('settings.manage'),
                    'can_view_activity' => $user->canPerm('activity.view'),
                    'permissions' => $user->role?->permissionMap() ?? ($user->is_admin ? ['*' => true] : []),
                    'departments' => $user->departments->map(fn ($d) => [
                        'id' => $d->id,
                        'name' => $d->name,
                        'code' => $d->code,
                        'is_primary' => (bool) $d->pivot->is_primary,
                    ])->values(),
                    'has_signature' => filled($user->signature_image),
                ] : null,
            ],
            'organization' => $organization ? [
                'id' => $organization->id,
                'name' => $organization->name,
                'logo_path' => $organization->logo_path,
            ] : null,
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'reset_password' => fn () => $request->session()->get('reset_password'),
                'reset_password_user' => fn () => $request->session()->get('reset_password_user'),
                'request_link' => fn () => $request->session()->get('request_link'),
            ],
            'unreadNotifications' => fn () => $user
                ? $user->appNotifications()->where('is_read', false)->count()
                : 0,
        ];
    }
}
