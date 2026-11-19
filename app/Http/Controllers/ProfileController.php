<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function edit(Request $request): Response
    {
        return Inertia::render('Profile/Edit', [
            'status' => session('status'),
            'savedSignature' => $request->user()->signature_image,
            'savedStamp' => $request->user()->stamp_image,
        ]);
    }

    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $data['phone_number'] = $data['phone_number'] ?? '';

        $request->user()->fill($data);

        if ($request->user()->isDirty('email')) {
            $request->user()->email_verified_at = null;
        }

        $request->user()->save();

        return back()->with('success', 'Profile updated.');
    }

    public function updateSignature(Request $request): RedirectResponse
    {
        abort(403, 'Only an administrator can assign signatures.');
    }

    public function destroySignature(Request $request): RedirectResponse
    {
        abort(403, 'Only an administrator can remove signatures.');
    }

    public function updateStamp(Request $request): RedirectResponse
    {
        abort(403, 'Only an administrator can assign stamps.');
    }

    public function destroyStamp(Request $request): RedirectResponse
    {
        abort(403, 'Only an administrator can remove stamps.');
    }
}
