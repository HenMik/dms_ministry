<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Department;
use App\Models\Position;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user()->canManageUsers(), 403);

        return Inertia::render('Users/Index', [
            'users' => User::with(['role', 'departments:id,name,code', 'positions:id,name,department_id'])
                ->orderBy('last_name')
                ->paginate(20)
                ->withQueryString()
                ->through(fn (User $managed) => [
                    ...$managed->makeHidden(['signature_image', 'stamp_image'])->toArray(),
                    'has_signature' => filled($managed->signature_image),
                    'signature_image' => $managed->signature_image,
                    'has_stamp' => filled($managed->stamp_image),
                    'stamp_image' => $managed->stamp_image,
                    'position_ids' => $managed->positions->pluck('id')->values()->all(),
                ]),
            'roles' => Role::orderBy('name')->get(),
            'departments' => Department::where('is_active', true)->orderBy('name')->get(['id', 'name', 'code']),
            'positions' => Position::query()
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'code', 'department_id']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user()->canManageUsers(), 403);

        $data = $request->validate([
            'first_name' => 'required|string|max:150',
            'last_name' => 'required|string|max:150',
            'email' => 'required|email|unique:users,email',
            'phone_number' => 'nullable|string|max:17',
            'role_id' => 'nullable|exists:roles,id',
            'is_approver' => 'boolean',
            'is_admin' => 'boolean',
            'password' => ['required', Password::defaults()],
            'department_ids' => ['array'],
            'department_ids.*' => ['integer', 'exists:departments,id'],
            'primary_department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'position_ids' => ['array'],
            'position_ids.*' => ['integer', 'exists:positions,id'],
        ]);

        $data['force_password_change'] = true;
        $data['password_changed_at'] = now();
        $data['is_approver'] = $request->boolean('is_approver');
        $data['is_admin'] = $request->boolean('is_admin');
        $data['phone_number'] = $data['phone_number'] ?? '';

        $user = User::create(collect($data)->except(['department_ids', 'primary_department_id', 'position_ids'])->all());
        $this->syncDepartments($user, $data['department_ids'] ?? [], $data['primary_department_id'] ?? null);
        $user->positions()->sync($data['position_ids'] ?? []);
        ActivityLog::record($request->user(), 'USER_CREATE', "Created user {$user->email}");

        return back()->with('success', 'User created.');
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()->canManageUsers(), 403);

        $data = $request->validate([
            'first_name' => 'required|string|max:150',
            'last_name' => 'required|string|max:150',
            'email' => 'required|email|unique:users,email,'.$user->id,
            'phone_number' => 'nullable|string|max:17',
            'role_id' => 'nullable|exists:roles,id',
            'is_approver' => 'boolean',
            'is_admin' => 'boolean',
            'is_active' => 'boolean',
            'password' => ['nullable', Password::defaults()],
            'department_ids' => ['array'],
            'department_ids.*' => ['integer', 'exists:departments,id'],
            'primary_department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'position_ids' => ['array'],
            'position_ids.*' => ['integer', 'exists:positions,id'],
            'signature_image' => ['nullable', 'string', 'starts_with:data:image/png;base64,', 'max:3000000'],
            'clear_signature' => ['boolean'],
            'stamp_image' => ['nullable', 'string', 'starts_with:data:image/png;base64,', 'max:3000000'],
            'clear_stamp' => ['boolean'],
        ]);

        $data['is_approver'] = $request->boolean('is_approver');
        $data['is_admin'] = $request->boolean('is_admin');
        $data['is_active'] = $request->boolean('is_active');
        $data['phone_number'] = $data['phone_number'] ?? '';

        if (empty($data['password'])) {
            unset($data['password']);
        } else {
            $data['force_password_change'] = true;
            $data['password_changed_at'] = now();
        }

        $signatureImage = $data['signature_image'] ?? null;
        $clearSignature = $request->boolean('clear_signature');
        $stampImage = $data['stamp_image'] ?? null;
        $clearStamp = $request->boolean('clear_stamp');
        unset($data['signature_image'], $data['clear_signature'], $data['stamp_image'], $data['clear_stamp']);

        $user->update(collect($data)->except(['department_ids', 'primary_department_id', 'position_ids'])->all());

        if ($clearSignature) {
            $user->update(['signature_image' => null]);
        } elseif (is_string($signatureImage) && $signatureImage !== '') {
            $user->update(['signature_image' => $signatureImage]);
        }

        if ($clearStamp) {
            $user->update(['stamp_image' => null]);
        } elseif (is_string($stampImage) && $stampImage !== '') {
            $user->update(['stamp_image' => $stampImage]);
        }

        if ($request->has('department_ids')) {
            $this->syncDepartments($user, $data['department_ids'] ?? [], $data['primary_department_id'] ?? null);
        }

        if ($request->has('position_ids')) {
            $user->positions()->sync($data['position_ids'] ?? []);
        }

        ActivityLog::record($request->user(), 'USER_UPDATE', "Updated user {$user->email}");

        return back()->with('success', 'User updated.');
    }

    public function resetPassword(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()->canManageUsers(), 403);

        $defaultPassword = 'ChangeMe123!';

        $user->forceFill([
            'password' => $defaultPassword,
            'force_password_change' => true,
            'password_changed_at' => now(),
            'is_active' => true,
        ])->save();

        ActivityLog::record(
            $request->user(),
            'PASSWORD_RESET_ADMIN',
            "Reset password for user {$user->email}"
        );

        return back()->with([
            'success' => "Password reset for {$user->email}. Temporary password: {$defaultPassword}",
            'reset_password' => $defaultPassword,
            'reset_password_user' => $user->email,
        ]);
    }

    public function team(Request $request): Response
    {
        return Inertia::render('Team/Index', [
            'users' => User::with(['role', 'departments:id,name'])
                ->where('is_active', true)
                ->orderBy('last_name')
                ->get(['id', 'first_name', 'last_name', 'email', 'phone_number', 'role_id', 'is_approver']),
        ]);
    }

    public function activityLogs(Request $request): Response
    {
        abort_unless($request->user()->canPerm('activity.view'), 403);

        return Inertia::render('Users/ActivityLogs', [
            'logs' => ActivityLog::with('user')->latest()->paginate(50),
        ]);
    }

    /**
     * @param  list<int>  $departmentIds
     */
    private function syncDepartments(User $user, array $departmentIds, ?int $primaryDepartmentId): void
    {
        $sync = [];

        foreach ($departmentIds as $departmentId) {
            $sync[$departmentId] = [
                'is_primary' => $primaryDepartmentId !== null && (int) $departmentId === $primaryDepartmentId,
            ];
        }

        if ($primaryDepartmentId && ! isset($sync[$primaryDepartmentId])) {
            $sync[$primaryDepartmentId] = ['is_primary' => true];
        }

        $user->departments()->sync($sync);
    }
}
