<?php

namespace Tests\Unit;

use App\Models\City;
use App\Models\Profile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Scout\EngineManager;
use Laravel\Scout\Engines\Engine;
use Mockery;
use Tests\TestCase;

/**
 * Tests anti-dérive de l'observer Scout sur Profile (bug annuaire /librairies).
 *
 * Simule le comportement de ModelObserver::saved de Scout :
 *   shouldBeSearchable()  → engine->update()
 *   sinon wasSearchableBeforeUpdate() → engine->delete()
 *   sinon                 → aucune opération
 */
class ProfileSearchableObserverTest extends TestCase
{
    use RefreshDatabase;

    /** @var array<int[]> */
    private array $indexed = [];

    /** @var array<int[]> */
    private array $removed = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->indexed = [];
        $this->removed = [];

        $test = $this;
        $engine = Mockery::mock(Engine::class)->makePartial();
        $engine->shouldReceive('update')->andReturnUsing(function ($models) use ($test) {
            $test->indexed[] = $models->pluck('id')->all();
        });
        $engine->shouldReceive('delete')->andReturnUsing(function ($models) use ($test) {
            $test->removed[] = $models->pluck('id')->all();
        });

        // Hermetique : forcer le driver meilisearch + sync SANS dependre du
        // .env local (SCOUT_DRIVER=meilisearch). En CI, sans .env, Scout v11
        // retombe sur son defaut 'collection' (engine no-op) et le mock
        // 'meilisearch' n'etait jamais resolu -> 3 faux echecs.
        config([
            'scout.driver' => 'meilisearch',
            'scout.queue' => false,
        ]);

        app(EngineManager::class)->extend('meilisearch', fn () => $engine);
    }

    private function makeProfile(string $type): Profile
    {
        $city = City::query()->firstOrCreate(['name' => 'Ville de test']);

        // withoutSyncingToSearch : la création ne doit pas polluer les captures
        return Profile::withoutSyncingToSearch(fn () => Profile::create([
            'user_id' => User::factory()->create()->id,
            'profile_type' => $type,
            'city_id' => $city->id,
            'subscription_type' => 'free',
        ]));
    }

    public function test_saving_a_librairie_never_unindexes_it(): void
    {
        $profile = $this->makeProfile('librairie');

        $profile->phone = '0612345678';
        $profile->save();

        $this->assertContains($profile->id, array_merge(...$this->indexed ?: [[]]));
        $this->assertSame([], $this->removed);
    }

    public function test_saving_a_passionne_never_triggers_a_deletion(): void
    {
        $profile = $this->makeProfile('passionné(e)');

        // Deux saves consécutifs d'un profil jamais indexé : zéro suppression
        // (l'ancien comportement générait une tempête de suppressions no-op).
        $profile->save();
        $profile->save();

        $this->assertSame([], $this->removed);
        $this->assertSame([], $this->indexed);
    }

    public function test_toggling_librairie_to_passionne_deletes_the_doc_exactly_once(): void
    {
        $profile = $this->makeProfile('librairie');

        // Bascule librairie → passionné(e) : suppression UNE fois...
        $profile->profile_type = 'passionné(e)';
        $profile->save();
        $this->assertContains($profile->id, array_merge(...$this->removed ?: [[]]));
        $this->assertSame([], $this->indexed);

        // ...puis save supplémentaire en passionné(e) : plus aucune opération.
        $this->indexed = [];
        $this->removed = [];
        $profile->save();
        $this->assertSame([], $this->removed);
        $this->assertSame([], $this->indexed);
    }

    public function test_toggling_back_to_librairie_reindexes_the_doc(): void
    {
        $profile = $this->makeProfile('passionné(e)');

        $profile->profile_type = 'librairie';
        $profile->save();

        $this->assertContains($profile->id, array_merge(...$this->indexed ?: [[]]));
        $this->assertSame([], $this->removed);
    }

    public function test_was_searchable_before_update_reflects_the_state_before_save(): void
    {
        $profile = $this->makeProfile('librairie');

        // Le profil reste librairie : après save, l'état pré-save doit rester
        // "librairie" (pas re-synchronisé par Eloquent avec la nouvelle valeur).
        $profile->save();
        $this->assertTrue($profile->wasSearchableBeforeUpdate());

        // Bascule : pré-save = librairie → suppression justifiée.
        $profile->profile_type = 'passionné(e)';
        $profile->save();
        $this->assertTrue($profile->wasSearchableBeforeUpdate());

        // Reste passionné(e) : pré-save = passionné(e) → aucune suppression.
        $profile->save();
        $this->assertFalse($profile->wasSearchableBeforeUpdate());
    }
}
