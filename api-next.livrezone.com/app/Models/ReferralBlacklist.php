<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Blacklist anti-abus du programme de parrainage : IP brute, domaine email
 * (jetable ou indésirable), ou fingerprint navigateur. Seedée avec les
 * domaines temporaires courants, complétée par l'admin.
 */
class ReferralBlacklist extends Model
{
    public const TYPE_IP = 'ip';

    public const TYPE_EMAIL_DOMAIN = 'email_domain';

    public const TYPE_FINGERPRINT = 'fingerprint';

    public const TYPES = [self::TYPE_IP, self::TYPE_EMAIL_DOMAIN, self::TYPE_FINGERPRINT];

    protected $fillable = ['type', 'value', 'reason'];

    /**
     * Le domaine email donné (partie après @, normalisée) est-il blacklisté ?
     */
    public static function emailDomainBlocked(string $email): bool
    {
        $domain = strtolower(substr(strrchr(trim($email), '@') ?: '', 1));

        return $domain !== '' && self::where('type', self::TYPE_EMAIL_DOMAIN)->where('value', $domain)->exists();
    }

    public static function ipBlocked(string $ip): bool
    {
        return self::where('type', self::TYPE_IP)->where('value', $ip)->exists();
    }
}
