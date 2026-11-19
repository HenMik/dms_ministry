<?php

$branding = '/home/henmik/Projects/dms/public/images/branding';
@mkdir($branding, 0777, true);

$copies = [
    '/home/henmik/.cursor/projects/home-henmik-Projects-board/assets/dms-login-office.jpg' => '/home/henmik/Projects/dms/public/images/dms-login.jpg',
    '/home/henmik/.cursor/projects/home-henmik-Projects-board/assets/ucssacco-logo.jpg' => $branding.'/ucssacco-logo.jpg',
    '/home/henmik/.cursor/projects/home-henmik-Projects-board/assets/malawi-government-logo.jpg' => $branding.'/malawi-government-logo.jpg',
];

foreach ($copies as $from => $to) {
    if (! is_file($from)) {
        fwrite(STDERR, "missing: {$from}\n");

        continue;
    }
    copy($from, $to);
    echo "copied {$to}\n";
}

$downloads = [
    // Wikimedia Commons — Coat of arms of Malawi (SVG rendered as PNG fallback via commons thumb)
    'malawi-coat-of-arms.png' => 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Coat_of_arms_of_Malawi.svg/512px-Coat_of_arms_of_Malawi.svg.png',
];

foreach ($downloads as $name => $url) {
    $dest = $branding.'/'.$name;
    $ctx = stream_context_create([
        'http' => [
            'timeout' => 20,
            'header' => "User-Agent: DMS-BrandingFetcher/1.0\r\n",
        ],
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
        ],
    ]);
    $data = @file_get_contents($url, false, $ctx);
    if ($data === false || strlen($data) < 500) {
        echo "download failed: {$name}\n";

        continue;
    }
    file_put_contents($dest, $data);
    echo "downloaded {$dest} (".strlen($data)." bytes)\n";
}
