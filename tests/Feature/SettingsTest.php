<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Support\AppSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesDmsUsers;
use Tests\TestCase;

class SettingsTest extends TestCase
{
    use CreatesDmsUsers;
    use RefreshDatabase;

    public function test_admin_can_view_and_update_settings(): void
    {
        $admin = $this->dmsUser('admin', ['is_admin' => true]);

        $this->actingAs($admin)
            ->get(route('settings.edit'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('Settings/Edit'));

        $this->actingAs($admin)
            ->put(route('settings.update'), [
                'require_otp_after_password' => true,
                'mail_mailer' => 'smtp',
                'mail_host' => 'smtp.example.com',
                'mail_port' => 587,
                'mail_username' => 'noreply@example.com',
                'mail_password' => 'secret-mail',
                'mail_scheme' => 'smtps',
                'mail_from_address' => 'dms@example.com',
                'mail_from_name' => 'DMS',
                'sms_enabled' => true,
                'sms_driver' => 'log',
                'sms_url' => 'https://clicksmsgateway.com',
                'sms_token' => 'sms-secret',
                'sms_sender' => 'DMS',
                'view_access_user_ids' => [$admin->id],
            ])
            ->assertRedirect();

        $this->assertSame([$admin->id], AppSettings::viewAccessUserIds());

        $this->assertTrue(AppSettings::requireOtpAfterPassword());
        $this->assertSame('smtp.example.com', AppSettings::get(AppSettings::MAIL_HOST));
        $this->assertSame('secret-mail', AppSettings::get(AppSettings::MAIL_PASSWORD));
        $this->assertSame('sms-secret', AppSettings::get(AppSettings::SMS_TOKEN));
        $this->assertNotSame('sms-secret', Setting::get(AppSettings::SMS_TOKEN));
    }

    public function test_non_admin_cannot_manage_settings(): void
    {
        $user = $this->dmsUser('viewer');

        $this->actingAs($user)
            ->get(route('settings.edit'))
            ->assertForbidden();
    }
}
