<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SearchHistory extends Model
{
    public $timestamps = false;

    protected $fillable = ['user_id', 'query', 'results_count', 'search_filters', 'searched_at'];

    protected function casts(): array
    {
        return [
            'search_filters' => 'array',
            'searched_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
