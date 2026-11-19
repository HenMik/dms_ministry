<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\ActivityLog;
use App\Services\PhoneOtpService;
use App\Support\AppSettings;
use App\Support\MalawiPhone;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class AuthenticatedSessionController extends Controller
{
    public function __construct(
        private readonly PhoneOtpService $otp,
    ) {}

    public function create(): Response
    {
        return Inertia::render('Auth/Login', [
            'status' => session('status'),
            'otpAfterPasswordEnabled' => AppSettings::requireOtpAfterPassword(),
        ]);
    }

    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();

        $user = $request->user();

        if (AppSettings::requireOtpAfterPassword()) {
            $phone = MalawiPhone::formatForSms((string) ($user?->phone_number ?? ''));
            if (! $user || ! $phone) {
                Auth::logout();

                throw ValidationException::withMessages([
                    'email' => 'A verified mobile number is required for the one-time code step. Ask an administrator to add your phone number.',
                ]);
            }

            try {
                $this->otp->requestLoginOtp((string) $user->phone_number);
            } catch (RuntimeException) {
                Auth::logout();

                throw ValidationException::withMessages([
                    'email' => 'Password was accepted, but we could not send a verification code. Try again shortly.',
                ]);
            }

            $request->session()->put([
                'otp_login_user_id' => $user->id,
                'otp_login_phone' => $phone,
                'otp_login_started_at' => now()->timestamp,
                'otp_login_remember' => $request->boolean('remember'),
            ]);

            Auth::logout();
            $request->session()->regenerate();

            return redirect()->route('login.otp.verify')->with(
                'status',
                'Enter the 6-digit code sent to '.MalawiPhone::mask($phone).'.',
            );
        }

        $request->session()->regenerate();
        ActivityLog::record($user, 'LOGIN', 'Signed in with password');

        return redirect()->intended(route('dashboard', absolute: false));
    }

    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        return redirect('/');
    }
}
