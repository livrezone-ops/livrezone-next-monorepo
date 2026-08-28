<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Supervision de la queue `database` (jobs Scout + mails).
 *
 * Détecte sans intervention humaine :
 *  - une accumulation de jobs en attente (worker mort, cron /etc/cron.d/lz-schedule
 *    disparu, ou débit insuffisant) ;
 *  - des jobs "reserved" bloqués au-delà de 2× retry_after (worker planté en plein
 *    traitement — c'est ce qui a causé la récidive Meilisearch d'août 2026) ;
 *  - des jobs échoués archivés dans `failed_jobs`.
 *
 * Planifié toutes les 5 minutes dans routes/console.php. N'écrit dans les logs QUE
 * en cas d'anomalie (pas de spam en fonctionnement normal).
 */
class QueueHealthCheck extends Command
{
    protected $signature = 'app:queue-health
        {--max-pending=50 : Nombre de jobs en attente au-delà duquel on alerte}
        {--max-age-minutes=30 : Âge (min) du plus vieux job en attente au-delà duquel on alerte}
        {--max-failed=0 : Nombre de jobs échoués au-delà duquel on alerte}';

    protected $description = 'Vérifie l’état de la queue database (backlog, jobs bloqués, échecs) et alerte dans les logs.';

    public function handle(): int
    {
        $connection = (string) config('queue.default');
        if ($connection !== 'database') {
            $this->info("Queue « {$connection} » : rien à superviser (driver non database).");

            return self::SUCCESS;
        }

        $config = config('queue.connections.database');
        $db = DB::connection($config['connection'] ?? null);
        $table = (string) ($config['table'] ?? 'jobs');
        $retryAfter = (int) ($config['retry_after'] ?? 90);
        $now = Carbon::now()->getTimestamp();

        $pending = (int) $db->table($table)->whereNull('reserved_at')->where('available_at', '<=', $now)->count();
        $delayed = (int) $db->table($table)->whereNull('reserved_at')->where('available_at', '>', $now)->count();
        $reserved = (int) $db->table($table)->whereNotNull('reserved_at')->count();
        $stuck = (int) $db->table($table)
            ->whereNotNull('reserved_at')
            ->where('reserved_at', '<', $now - (2 * $retryAfter))
            ->count();

        $oldestPendingAt = $db->table($table)
            ->whereNull('reserved_at')
            ->min('available_at');
        $oldestAgeMinutes = $oldestPendingAt !== null
            ? (int) floor(max(0, $now - (int) $oldestPendingAt) / 60)
            : 0;

        $failedTable = (string) config('queue.failed.table', 'failed_jobs');
        $failed = Schema::hasTable($failedTable)
            ? (int) $db->table($failedTable)->count()
            : 0;

        $this->table(['Métrique', 'Valeur', 'Seuil'], [
            ['En attente', $pending, (int) $this->option('max-pending')],
            ['Retardés (delayed)', $delayed, '—'],
            ['Réservés (en cours)', $reserved, '—'],
            ['Réservés bloqués', $stuck, 0],
            ['Âge du plus vieux job (min)', $oldestAgeMinutes, (int) $this->option('max-age-minutes')],
            ['Jobs échoués (failed_jobs)', $failed, (int) $this->option('max-failed')],
        ]);

        $issues = [];
        $maxPending = (int) $this->option('max-pending');
        $maxAge = (int) $this->option('max-age-minutes');
        $maxFailed = (int) $this->option('max-failed');

        if ($stuck > 0) {
            $issues[] = "{$stuck} job(s) réservé(s) bloqué(s) depuis > ".(2 * $retryAfter).' s — le worker est probablement mort en plein traitement. Diagnostic : docker exec php-fpm-8.5 php /var/www/html/api-next.livrezone.com/artisan queue:work --stop-when-empty --verbose ; puis examiner les jobs concernés.';
        }
        if ($pending > $maxPending) {
            $issues[] = "Backlog : {$pending} job(s) en attente (seuil {$maxPending}) — vérifier que le runner cron de /etc/cron.d/lz-schedule est bien en place.";
        }
        if ($oldestAgeMinutes > $maxAge) {
            $issues[] = "Job le plus vieux en attente : {$oldestAgeMinutes} min (seuil {$maxAge} min) — le worker ne consomme plus.";
        }
        if ($failed > $maxFailed) {
            $issues[] = "{$failed} job(s) échoué(s) dans {$failedTable} — inspecter : php artisan queue:failed, puis queue:retry {id} après correction.";
        }

        if ($issues === []) {
            return self::SUCCESS;
        }

        foreach ($issues as $issue) {
            $this->error($issue);
            Log::critical('Queue database en anomalie : '.$issue, [
                'pending' => $pending,
                'delayed' => $delayed,
                'reserved' => $reserved,
                'stuck' => $stuck,
                'oldest_age_minutes' => $oldestAgeMinutes,
                'failed' => $failed,
            ]);
        }

        return self::FAILURE;
    }
}
