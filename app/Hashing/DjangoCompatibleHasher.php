<?php

namespace App\Hashing;

use Illuminate\Contracts\Hashing\Hasher as HasherContract;
use Illuminate\Hashing\BcryptHasher;

class DjangoCompatibleHasher implements HasherContract
{
    public function __construct(private BcryptHasher $bcrypt = new BcryptHasher) {}

    public function info($hashedValue): array
    {
        if ($this->isDjangoHash((string) $hashedValue)) {
            return ['algo' => 'pbkdf2_sha256', 'algoName' => 'django-pbkdf2-sha256', 'options' => []];
        }

        return $this->bcrypt->info($hashedValue);
    }

    public function make($value, array $options = []): string
    {
        return $this->bcrypt->make($value, $options);
    }

    public function check($value, $hashedValue, array $options = []): bool
    {
        $hashedValue = (string) $hashedValue;

        if ($this->isDjangoHash($hashedValue)) {
            return $this->checkDjango($value, $hashedValue);
        }

        return $this->bcrypt->check($value, $hashedValue, $options);
    }

    public function needsRehash($hashedValue, array $options = []): bool
    {
        if ($this->isDjangoHash((string) $hashedValue)) {
            return true;
        }

        return $this->bcrypt->needsRehash($hashedValue, $options);
    }

    private function isDjangoHash(string $hashedValue): bool
    {
        return str_starts_with($hashedValue, 'pbkdf2_sha256$');
    }

    private function checkDjango(string $value, string $hashedValue): bool
    {
        $parts = explode('$', $hashedValue, 4);

        if (count($parts) !== 4) {
            return false;
        }

        [, $iterations, $salt, $hash] = $parts;

        if (! ctype_digit($iterations) || $salt === '' || $hash === '') {
            return false;
        }

        $calculated = hash_pbkdf2('sha256', $value, $salt, (int) $iterations, 32, true);
        $encoded = rtrim(strtr(base64_encode($calculated), '+', '.'), '=');

        return hash_equals($hash, $encoded);
    }

    public function setRounds(int $rounds): static
    {
        $this->bcrypt->setRounds($rounds);

        return $this;
    }
}
