<?php

namespace Tests\Feature;

use App\Models\OtpCode;
use App\Support\AppSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesDmsUsers;
use Tests\TestCase;

class PasswordLoginOtpTest extends TestCase
{
    use CreatesDmsUsers;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.sms_gateway.driver' => 'log',
            'services.sms_gateway.enabled' => true,
            'services.sms_gateway.token' => 'test-token',
            'services.sms_gateway.url' => 'https://example.com/sms',
        ]);
    }

    public function test_login_page_is_password_only(): void
    {
        $this->get('/login')->assertOk()->assertInertia(fn ($page) => $page
            ->component('Auth/Login')
            ->where('otpAfterPasswordEnabled', false));
    }

    public function test_password_login_requires_otp_when_enabled(): void
    {
        AppSettings::update([
            AppSettings::AUTH_REQUIRE_OTP_AFTER_PASSWORD => true,
            AppSettings::SMS_DRIVER => 'log',
            AppSettings::SMS_ENABLED => true,
        ]);

        $user = $this->dmsUser('viewer', [
            'phone_number' => '+265991234567',
            'email' => 'otp.user@example.com',
            'password' => 'password',
        ]);

        $this->from('/login')
            ->post('/login', [
                'email' => $user->email,
                'password' => 'password',
            ])
            ->assertRedirect(route('login.otp.verify'));

        $this->assertGuest();
        $this->assertNotNull(OtpCode::query()->where('user_id', $user->id)->first());

        $otp = OtpCode::query()->where('user_id', $user->id)->latest('id')->firstOrFail();
        $plain = null;
        for ($i = 100000; $i <= 999999; $i++) {
            $hash = hash_hmac('sha256', (string) $i, (string) config('app.key'));
            if (hash_equals($otp->code, $hash)) {
                $plain = (string) $i;
                break;
            }
        }
        $this->assertNotNull($plain);

        $this->post('/login/otp/verify', ['otp' => $plain])
            ->assertRedirect(route('dashboard'));

        $this->assertAuthenticatedAs($user);
    }

    public function test_password_login_skips_otp_when_disabled(): void
    {
        AppSettings::update([
            AppSettings::AUTH_REQUIRE_OTP_AFTER_PASSWORD => false,
        ]);

        $user = $this->dmsUser('viewer', [
            'email' => 'plain.user@example.com',
            'password' => 'password',
        ]);

        $this->post('/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertRedirect(route('dashboard', absolute: false));

        $this->assertAuthenticatedAs($user);
    }
}
