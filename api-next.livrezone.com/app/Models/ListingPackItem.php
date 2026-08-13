<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ListingPackItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'pack_listing_id',
        'child_listing_id',
        'sort_order',
    ];

    public function packListing()
    {
        return $this->belongsTo(Listing::class, 'pack_listing_id');
    }

    public function childListing()
    {
        return $this->belongsTo(Listing::class, 'child_listing_id');
    }
}
