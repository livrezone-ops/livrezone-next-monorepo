<?php

namespace App\Services\Referral;

use App\Jobs\EvaluateReferralRewards;
use App\Models\Profile;
use App\Models\ReferralBlacklist;
use App\Models\ReferralReward;
use App\Models\ReferralSignup;
use App\Models\ReferralVisit;
use App\Models\User;
use App\Services\TelegramNotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Cœur du tracking parrainage : comptage des visites uniques (avec
 * dédoublonnage 24 h, filtre bots, blacklists, caps) et attribution du
 * parrain à l'inscription. Les compteurs profiles.referral_shares_count /
 * referral_signups_count ne sont incrémentés QUE depuis cette classe et
 * ReferralRewardService — jamais depuis un contrôleur.
 */
class ReferralTrackingService
{
    public const COOKIE_NAME = 'lz_ref';

    /** Alphabet sans ambiguïté pour les codes (pas de 0/O/1/I/L). */
    private const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

    /** UA / signatures de clients non humains : visite jamais comptée. */
    private const BOT_PATTERN = '/(bot|crawl|spider|slurp|headless|phantom|curl|wget|python-requests|python-urllib|java\/|apache-httpclient|go-http|libwww|httpclient|scrapy|puppeteer|playwright|monitor|uptime|pingdom|lighthouse)/i';

    public function __construct(
        private readonly ReferralSettings $settings,
        private readonly TelegramNotificationService $telegram,
    ) {}

    /**
     * Génère un code de parrainage unique (8 caractères, sans ambiguïté).
     */
    public function generateUniqueCode(): string
    {
        do {
            $code = substr(str_shuffle(str_repeat(self::CODE_ALPHABET, 4)), 0, 8);
        } while (Profile::where('referral_code', $code)->exists());

        return $code;
    }

    /**
     * Résout un code de parrainage en parrain éligible (programme actif,
     * compte actif, profil non blacklisté du programme). Retourne null sinon.
     * Le User retourné porte sa relation profile chargée (compteurs/blocage).
     */
    public function resolveReferrer(?string $code, ?User $visitor = null): ?User
    {
        if (! $code || ! $this->settings->isEnabled()) {
            return null;
        }

        $profile = Profile::with('user')
            ->where('referral_code', strtoupper(trim($code)))
            ->first();

        $user = $profile?->user;

        if (! $user || ! $user->is_active || $profile->isReferralBlocked()) {
            return null;
        }

        // Le parrain ne se parraine pas lui-même.
        if ($visitor && $visitor->id === $user->id) {
            return null;
        }

        return $user->setRelation('profile', $profile);
    }

    /**
     * Enregistre une visite sur un lien de parrainage (endpoint /referral/track).
     * Retourne ['counted' => bool, 'reason' => ?string].
     */
    public function trackVisit(User $referrer, Request $request): array
    {
        $ip = (string) $request->ip();
        $ua = Str::limit((string) $request->userAgent(), 500);
        $fingerprint = $this->fingerprint($request);
        $ipHash = $this->hashIp($ip);

        // 1. IP blacklistée : visite ignorée, pas de cookie d'attribution.
        if (ReferralBlacklist::ipBlocked($ip)) {
            return ['counted' => false, 'reason' => 'blacklist_ip'];
        }

        // 2. Détecte le fingerprint du parrain lui-même (auto-parrainage) :
        // mémorisé pour rejeter ensuite les inscriptions venues de sa machine.
        if (Cache::get($this->selfFingerprintKey($referrer->id)) === $fingerprint) {
            return ['counted' => false, 'reason' => 'self_fingerprint'];
        }

        $isBot = $this->isBot($request);
        $alreadySeen = ReferralVisit::where('referrer_user_id', $referrer->id)
            ->where('fingerprint_hash', $fingerprint)
            ->where('created_at', '>=', now()->subDay())
            ->exists();

        $counted = ! $isBot && ! $alreadySeen;

        // 3. Cap anti-abus : au-delà du plafond, les visites restent loggées
        // mais ne comptent plus ; l'admin est alerté une fois par jour.
        if ($counted && $this->settings->maxVisitsPerDay() > 0) {
            $todayCounted = ReferralVisit::where('referrer_user_id', $referrer->id)
                ->where('counted', true)
                ->where('created_at', '>=', now()->startOfDay())
                ->count();

            if ($todayCounted >= $this->settings->maxVisitsPerDay()) {
                $counted = false;
                $this->notifyAdminOncePerDay(
                    'referral.cap.visits.'.$referrer->id,
                    "🚧 Parrainage : {$referrer->name} (user #{$referrer->id}) a atteint la limite de "
                    .$this->settings->maxVisitsPerDay().' visites/jour. Visites suivantes non comptées.'
                );
            }
        }

        ReferralVisit::create([
            'referrer_user_id' => $referrer->id,
            'fingerprint_hash' => $fingerprint,
            'ip_hash' => $ipHash,
            'user_agent' => $isBot ? null : $ua,
            'referer' => Str::limit((string) $request->headers->get('referer'), 500),
            'landing_path' => Str::limit((string) $request->input('path', '/'), 250),
            'country' => Str::upper(Str::limit((string) $request->header('CF-IPCountry', ''), 2)),
            'is_bot' => $isBot,
            'counted' => $counted,
            'created_at' => now(),
        ]);

        if ($counted) {
            $referrer->profile->increment('referral_shares_count');

            // Paliers conditionnés sur les visites : évalués au moment où le
            // compteur atteint exactement un seuil (ou un multiple pour les
            // répétables). Idempotent — un franchissement raté (correction
            // manuelle, contre-temps) reste couvrable via l'endpoint admin.
            $this->dispatchEvaluationOnVisitsThreshold($referrer);
        }

        return ['counted' => $counted, 'reason' => $isBot ? 'bot' : ($alreadySeen ? 'duplicate' : null)];
    }

    /**
     * Déclenche l'évaluation des paliers « visites » quand le compteur vient
     * d'atteindre un seuil actif (franchissement exact uniquement : evaluate()
     * étant idempotent, l'objectif est d'éviter un job par visite).
     */
    private function dispatchEvaluationOnVisitsThreshold(User $referrer): void
    {
        $thresholds = ReferralReward::active()
            ->where('condition_type', 'visits')
            ->pluck('threshold_value');

        if ($thresholds->isEmpty()) {
            return;
        }

        $count = (int) $referrer->profile->referral_shares_count;
        $crossed = $thresholds->contains(fn ($threshold) => $threshold > 0 && $count % $threshold === 0);

        if ($crossed) {
            EvaluateReferralRewards::dispatch($referrer->id);
        }
    }

    /**
     * Attribue le parrain d'une inscription (cookie `lz_ref` posé par /track,
     * repli sur un ref_code passé explicitement par le front). À appeler UNE
     * fois, juste après la création du compte. Les comptes créés via provider
     * social (email vérifié par Google…) sont considérés validés d'office.
     */
    public function attributeSignup(User $filleul, Request $request): ?ReferralSignup
    {
        if (! $this->settings->isEnabled()) {
            return null;
        }

        // Un filleul n'a qu'un parrain : toute attribution ultérieure est ignorée.
        // Requête directe (pas la relation en cache) : ensureProfileExists crée le
        // profil via profile()->create(), qui ne peuple pas la relation parent.
        $filleulProfile = $filleul->profile()->first();
        if (! $filleulProfile || $filleulProfile->referred_by_id
            || ReferralSignup::where('filleul_user_id', $filleul->id)->exists()) {
            return null;
        }

        $code = $request->cookie(self::COOKIE_NAME) ?: $request->input('ref_code');
        $referrer = $this->resolveReferrer($code, $filleul);

        if (! $referrer) {
            return null;
        }

        $ip = (string) $request->ip();
        $fingerprint = $this->fingerprint($request);
        $email = (string) $filleul->email;

        // Anti-fraude à l'inscription : chaque règle invalide et alerte l'admin.
        $invalidReason = $this->signupInvalidReason($filleul, $referrer, $ip, $fingerprint, $email);

        $signup = ReferralSignup::create([
            'referrer_user_id' => $referrer->id,
            'filleul_user_id' => $filleul->id,
            'status' => $invalidReason !== null ? ReferralSignup::STATUS_INVALID : ReferralSignup::STATUS_PENDING,
            'invalid_reason' => $invalidReason,
            'ip_hash' => $this->hashIp($ip),
            'fingerprint_hash' => $fingerprint,
        ]);

        $filleulProfile->forceFill(['referred_by_id' => $referrer->id])->save();

        if ($invalidReason !== null) {
            $this->notifyAdmin(
                "⚠️ Parrainage : inscription suspecte rejetée — {$filleul->email} → parrain {$referrer->name}. "
                ."Raison : {$invalidReason}."
            );

            return $signup;
        }

        // Provider social : email déjà validé par le fournisseur.
        if ($filleul->provider !== null) {
            app(ReferralRewardService::class)->onSignupValidated($filleul);
        }

        return $signup;
    }

    /**
     * Raison d'invalidité d'une inscription, ou null si elle est recevable.
     */
    private function signupInvalidReason(User $filleul, User $referrer, string $ip, string $fingerprint, string $email): ?string
    {
        if (ReferralBlacklist::ipBlocked($ip)) {
            return 'blacklist_ip';
        }

        $domain = strtolower(substr(strrchr($email, '@') ?: '', 1));
        if ($domain === '' || ReferralBlacklist::emailDomainBlocked($email)) {
            return $domain === '' ? 'email_invalide' : 'email_temporaire';
        }

        // Machine du parrain (fingerprint mémorisé quand il a suivi son propre lien).
        if (Cache::get($this->selfFingerprintKey($referrer->id)) === $fingerprint) {
            return 'self_referral';
        }

        // Multi-comptes : ce fingerprint (IP+UA+langue) a déjà parrainé quelqu'un.
        if (ReferralSignup::where('fingerprint_hash', $fingerprint)->exists()) {
            return 'duplicate_fingerprint';
        }

        return null;
    }

    /**
     * Fingerprint de la requête courante : hash stable IP + UA + Accept-Language.
     */
    public function fingerprint(Request $request): string
    {
        $raw = implode('|', [
            (string) $request->ip(),
            (string) $request->userAgent(),
            (string) $request->headers->get('accept-language'),
        ]);

        return hash('sha256', $raw.config('app.key'));
    }

    /**
     * Hash HMAC de l'IP : traçable en interne, jamais lisible en clair (RGPD).
     */
    public function hashIp(string $ip): string
    {
        return hash_hmac('sha256', $ip, (string) config('app.key'));
    }

    public function isBot(Request $request): bool
    {
        // Requêtes HEAD et clients sans Accept-Language : quasi jamais humains.
        if ($request->isMethod('HEAD')) {
            return true;
        }

        $ua = (string) $request->userAgent();

        return $ua === ''
            || preg_match(self::BOT_PATTERN, $ua) === 1
            || ! $request->headers->has('accept-language');
    }

    /**
     * Mémorise (30 j) que ce fingerprint appartient au parrain lui-même :
     * suivi de son propre lien → visite non comptée, inscriptions depuis sa
     * machine rejetées (auto-parrainage).
     */
    public function rememberSelfFingerprint(User $user, Request $request): void
    {
        Cache::put($this->selfFingerprintKey($user->id), $this->fingerprint($request), now()->addDays(30));
    }

    private function selfFingerprintKey(int $userId): string
    {
        return "referral.selffp.{$userId}";
    }

    /**
     * Notification Telegram admin — suppression de spam : un événement
     * identique (clé) n'est notifié qu'une fois par jour.
     */
    public function notifyAdminOncePerDay(string $key, string $message): void
    {
        if (! Cache::add("referral.notif.{$key}", true, now()->addDay())) {
            return;
        }

        $this->notifyAdmin($message);
    }

    public function notifyAdmin(string $message): void
    {
        if (! $this->settings->notifyAdmin()) {
            return;
        }

        $this->telegram->notifyAdmin($message);
    }
}
