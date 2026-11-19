<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\AppSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function edit(Request $request): Response
    {
        abort_unless($request->user()?->canPerm('settings.manage'), 403);

        $settings = AppSettings::forAdminForm();

        return Inertia::render('Settings/Edit', [
            'settings' => [
                'require_otp_after_password' => (bool) $settings[AppSettings::AUTH_REQUIRE_OTP_AFTER_PASSWORD],
                'mail_mailer' => (string) $settings[AppSettings::MAIL_MAILER],
                'mail_host' => (string) $settings[AppSettings::MAIL_HOST],
                'mail_port' => (string) $settings[AppSettings::MAIL_PORT],
                'mail_username' => (string) $settings[AppSettings::MAIL_USERNAME],
                'mail_password_configured' => (bool) ($settings[AppSettings::MAIL_PASSWORD]['configured'] ?? false),
                'mail_scheme' => (string) $settings[AppSettings::MAIL_SCHEME],
                'mail_from_address' => (string) $settings[AppSettings::MAIL_FROM_ADDRESS],
                'mail_from_name' => (string) $settings[AppSettings::MAIL_FROM_NAME],
                'sms_enabled' => (bool) $settings[AppSettings::SMS_ENABLED],
                'sms_driver' => (string) $settings[AppSettings::SMS_DRIVER],
                'sms_url' => (string) $settings[AppSettings::SMS_URL],
                'sms_token_configured' => (bool) ($settings[AppSettings::SMS_TOKEN]['configured'] ?? false),
                'sms_sender' => (string) $settings[AppSettings::SMS_SENDER],
                'view_access_user_ids' => AppSettings::viewAccessUserIds(),
            ],
            'users' => User::where('is_active', true)
                ->orderBy('first_name')
                ->orderBy('last_name')
                ->get(['id', 'first_name', 'last_name', 'email']),
            'mailerOptions' => [
                ['value' => 'smtp', 'label' => 'SMTP'],
                ['value' => 'log', 'label' => 'Log (development)'],
                ['value' => 'array', 'label' => 'Array (testing)'],
            ],
            'smsDriverOptions' => [
                ['value' => 'sms', 'label' => 'ClickSMS gateway'],
                ['value' => 'log', 'label' => 'Log (development)'],
            ],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        abort_unless($request->user()?->canPerm('settings.manage'), 403);

        $data = $request->validate([
            'require_otp_after_password' => ['required', 'boolean'],
            'mail_mailer' => ['required', 'string', 'in:smtp,log,array'],
            'mail_host' => ['nullable', 'string', 'max:255'],
            'mail_port' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'mail_username' => ['nullable', 'string', 'max:255'],
            'mail_password' => ['nullable', 'string', 'max:255'],
            'mail_scheme' => ['nullable', 'string', 'max:16'],
            'mail_from_address' => ['required', 'email', 'max:255'],
            'mail_from_name' => ['required', 'string', 'max:255'],
            'sms_enabled' => ['required', 'boolean'],
            'sms_driver' => ['required', 'string', 'in:sms,log'],
            'sms_url' => ['nullable', 'url', 'max:255'],
            'sms_token' => ['nullable', 'string', 'max:2000'],
            'sms_sender' => ['nullable', 'string', 'max:32'],
            'view_access_user_ids' => ['array'],
            'view_access_user_ids.*' => ['integer', 'exists:users,id'],
        ]);

        AppSettings::update([
            AppSettings::AUTH_REQUIRE_OTP_AFTER_PASSWORD => $data['require_otp_after_password'],
            AppSettings::MAIL_MAILER => $data['mail_mailer'],
            AppSettings::MAIL_HOST => $data['mail_host'] ?? '',
            AppSettings::MAIL_PORT => (string) ($data['mail_port'] ?? ''),
            AppSettings::MAIL_USERNAME => $data['mail_username'] ?? '',
            AppSettings::MAIL_PASSWORD => $data['mail_password'] ?? '',
            AppSettings::MAIL_SCHEME => $data['mail_scheme'] ?? '',
            AppSettings::MAIL_FROM_ADDRESS => $data['mail_from_address'],
            AppSettings::MAIL_FROM_NAME => $data['mail_from_name'],
            AppSettings::SMS_ENABLED => $data['sms_enabled'],
            AppSettings::SMS_DRIVER => $data['sms_driver'],
            AppSettings::SMS_URL => $data['sms_url'] ?? '',
            AppSettings::SMS_TOKEN => $data['sms_token'] ?? '',
            AppSettings::SMS_SENDER => $data['sms_sender'] ?? '',
            AppSettings::DOCUMENTS_VIEW_ACCESS_USER_IDS => $data['view_access_user_ids'] ?? [],
        ]);

        return back()->with('success', 'Notification and login settings saved.');
    }
}
