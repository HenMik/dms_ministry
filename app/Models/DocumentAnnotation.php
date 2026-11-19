<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentAnnotation extends Model
{
    protected $fillable = [
        'document_id', 'user_id', 'annotation_type', 'page_number', 'coordinates',
        'content', 'color', 'resolved', 'resolved_by_id', 'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'coordinates' => 'array',
            'resolved' => 'boolean',
            'resolved_at' => 'datetime',
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

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by_id');
    }
}
