<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class QueueHealthCheckTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // phpunit.xml force QUEUE_CONNECTION=sync ; la commande ne supervise que
        // le driver database (tables jobs/failed_jobs), on le restaure ici.
        config(['queue.default' => 'database']);
    }

    private function insertJob(array $overrides = []): void
    {
        $now = Carbon::now()->getTimestamp();

        DB::table('jobs')->insert(array_merge([
            'queue' => 'default',
            'payload' => json_encode(['displayName' => 'App\\Jobs\\FakeJob', 'data' => []]),
            'attempts' => 0,
            'reserved_at' => null,
            'available_at' => $now,
            'created_at' => $now,
        ], $overrides));
    }

    public function test_passe_silencieusement_quand_la_queue_est_saine(): void
    {
        Log::spy()->shouldReceive('critical')->never();

        $this->artisan('app:queue-health')->assertSuccessful();
    }

    public function test_alerte_sur_backlog_de_jobs_en_attente(): void
    {
        for ($i = 0; $i < 3; $i++) {
            $this->insertJob();
        }

        Log::spy()->shouldReceive('critical')->atLeast()->once();

        $this->artisan('app:queue-health', ['--max-pending' => 2])
            ->assertFailed();
    }

    public function test_alerte_sur_job_reserve_bloque_worker_mort(): void
    {
        $this->insertJob([
            'attempts' => 1,
            'reserved_at' => Carbon::now()->getTimestamp() - 300, // > 2 × retry_after (90 s)
        ]);

        Log::spy()->shouldReceive('critical')->atLeast()->once();

        $this->artisan('app:queue-health')->assertFailed();
    }

    public function test_alerte_sur_jobs_echoues_archives(): void
    {
        DB::table('failed_jobs')->insert([
            'uuid' => '11111111-1111-1111-1111-111111111111',
            'connection' => 'database',
            'queue' => 'default',
            'payload' => '{}',
            'exception' => 'boom',
            'failed_at' => now(),
        ]);

        Log::spy()->shouldReceive('critical')->atLeast()->once();

        $this->artisan('app:queue-health')->assertFailed();
    }

    public function test_ne_logge_pas_les_jobs_delayed_normaux_comme_backlog(): void
    {
        $this->insertJob(['available_at' => Carbon::now()->addMinutes(5)->getTimestamp()]);

        Log::spy()->shouldReceive('critical')->never();

        $this->artisan('app:queue-health')->assertSuccessful();
    }
}
