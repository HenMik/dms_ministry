<?php

namespace Tests\Feature;

use App\Support\AppSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesDmsUsers;
use Tests\TestCase;

class PhoneOtpLoginTest extends TestCase
{
    use CreatesDmsUsers;
    use RefreshDatabase;

    public function test_phone_only_login_endpoint_is_removed(): void
    {
        $this->post('/login/otp', ['phone' => '0991234567'])->assertNotFound();
    }

    public function test_otp_verify_requires_enabled_setting_and_session(): void
    {
        AppSettings::update([
            AppSettings::AUTH_REQUIRE_OTP_AFTER_PASSWORD => false,
        ]);

        $this->get(route('login.otp.verify'))->assertRedirect(route('login'));
    }
}
