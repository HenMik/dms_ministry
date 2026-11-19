<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class PasswordChangeController extends Controller
{
    public function edit(): Response
    {
        return Inertia::render('Auth/ForceChangePassword');
    }

    public function update(Request $request): RedirectResponse
    {
        $request->validate([
            'current_password' => 'required|current_password',
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        $user = $request->user();
        $user->update([
            'password' => $request->password,
            'force_password_change' => false,
            'password_changed_at' => now(),
            'password_expires_at' => now()->addDays($user->password_expires_days ?: 90),
        ]);

        ActivityLog::record($user, 'PASSWORD_CHANGE', 'Password changed');

        return redirect()->route('dashboard')->with('success', 'Password updated.');
    }
}
