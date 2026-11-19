<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Services\PhoneOtpService;
use App\Support\AppSettings;
use App\Support\MalawiPhone;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class PhoneOtpLoginController extends Controller
{
    public function __construct(
        private readonly PhoneOtpService $otp,
    ) {}

    public function showVerify(Request $request): Response|RedirectResponse
    {
        if (! AppSettings::requireOtpAfterPassword()) {
            return redirect()->route('login');
        }

        if (! $request->session()->has('otp_login_phone')) {
            return redirect()->route('login');
        }

        return Inertia::render('Auth/VerifyOtp', [
            'maskedPhone' => MalawiPhone::mask((string) $request->session()->get('otp_login_phone')),
            'status' => session('status'),
            'expiresIn' => PhoneOtpService::TTL_MINUTES * 60,
        ]);
    }

    public function verify(Request $request): RedirectResponse
    {
        if (! AppSettings::requireOtpAfterPassword()) {
            return redirect()->route('login');
        }

        $data = $request->validate([
            'otp' => ['required', 'digits:6'],
        ]);

        $userId = $request->session()->get('otp_login_user_id');
        if (! $userId) {
            return redirect()->route('login')->withErrors([
                'otp' => 'Invalid or expired code. Sign in again.',
            ]);
        }

        $started = (int) $request->session()->get('otp_login_started_at', 0);
        if ($started && now()->timestamp - $started > PhoneOtpService::TTL_MINUTES * 60 + 30) {
            $request->session()->forget(['otp_login_user_id', 'otp_login_phone', 'otp_login_started_at', 'otp_login_remember']);

            return redirect()->route('login')->withErrors([
                'otp' => 'Your code has expired. Sign in again.',
            ]);
        }

        $result = $this->otp->verifyLoginOtp((int) $userId, $data['otp']);

        if (! ($result['ok'] ?? false)) {
            $message = match ($result['reason'] ?? 'invalid') {
                'expired' => 'Your code has expired. Sign in again.',
                'locked' => 'Too many incorrect attempts. Sign in again.',
                'inactive' => 'This account is inactive. Contact an administrator.',
                default => 'Incorrect code. Try again.',
            };

            if (in_array($result['reason'] ?? '', ['expired', 'locked'], true)) {
                $request->session()->forget(['otp_login_user_id', 'otp_login_phone', 'otp_login_started_at', 'otp_login_remember']);

                return redirect()->route('login')->withErrors(['email' => $message]);
            }

            return back()->withErrors(['otp' => $message]);
        }

        $user = $result['user'];
        $remember = (bool) $request->session()->get('otp_login_remember', false);
        Auth::login($user, $remember);
        $request->session()->regenerate();
        $request->session()->forget(['otp_login_user_id', 'otp_login_phone', 'otp_login_started_at', 'otp_login_remember']);

        ActivityLog::record($user, 'LOGIN_OTP', 'Signed in with password and SMS OTP');

        return redirect()->intended(route('dashboard', absolute: false));
    }

    public function resend(Request $request): RedirectResponse
    {
        if (! AppSettings::requireOtpAfterPassword()) {
            return redirect()->route('login');
        }

        $phone = (string) $request->session()->get('otp_login_phone', '');
        if ($phone === '') {
            return redirect()->route('login');
        }

        try {
            $result = $this->otp->requestLoginOtp($phone);
        } catch (RuntimeException) {
            return back()->withErrors([
                'otp' => 'We could not resend the code right now. Try again shortly.',
            ]);
        }

        if (($result['reason'] ?? null) === 'not_found') {
            $request->session()->forget(['otp_login_user_id', 'otp_login_phone', 'otp_login_started_at', 'otp_login_remember']);

            return redirect()->route('login')->withErrors([
                'email' => 'This number is not linked to an active account.',
            ]);
        }

        if ($result['cooldown']) {
            return back()->withErrors([
                'otp' => 'Please wait a moment before requesting another code.',
            ]);
        }

        $user = $result['user'] ?? null;
        if ($user) {
            $request->session()->put([
                'otp_login_user_id' => $user->id,
                'otp_login_started_at' => now()->timestamp,
            ]);
        }

        return back()->with('status', 'A new code has been sent.');
    }
}
