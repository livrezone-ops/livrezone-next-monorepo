<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Réglages applicatifs pilotés depuis l'admin (clé/valeur).
 * Survit aux déploiements et aux cache:clear, contrairement au cache seul.
 */
class Setting extends Model
{
    protected $primaryKey = 'key';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['key', 'value'];
}
