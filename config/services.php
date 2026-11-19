<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'vapid' => [
        'public_key' => env('VAPID_PUBLIC_KEY'),
        'private_key' => env('VAPID_PRIVATE_KEY'),
        'subject' => env('VAPID_SUBJECT', 'mailto:admin@ucssacco.com'),
    ],

    /*
    | Same ClickSMS gateway used by the UCSSACCO loans / member portal.
    | Set SMS_GATEWAY_DRIVER=log for local development (OTP written to the log).
    */
    'sms_gateway' => [
        'enabled' => env('SMS_GATEWAY_ENABLED', true),
        'driver' => env('SMS_GATEWAY_DRIVER', env('APP_ENV') === 'local' ? 'log' : 'sms'),
        'url' => env('SMS_GATEWAY_URL', 'https://clicksmsgateway.com'),
        'token' => env('SMS_GATEWAY_TOKEN'),
        'sender' => env('SMS_GATEWAY_SENDER', 'ucssacco'),
    ],

];
