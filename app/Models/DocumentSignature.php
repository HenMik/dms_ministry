<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentSignature extends Model
{
    protected $fillable = [
        'document_id', 'user_id', 'signature_type', 'signature_data', 'signed_at',
        'verified', 'verification_certificate', 'ip_address', 'user_agent',
    ];

    protected function casts(): array
    {
        return [
            'signature_data' => 'array',
            'signed_at' => 'datetime',
            'verified' => 'boolean',
        ];
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
