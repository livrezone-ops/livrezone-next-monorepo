<?php

use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

// Expiration des abonnements (downgrade Free + désactivation des annonces excédentaires).
Schedule::command('app:process-subscriptions')->dailyAt('03:00');

// Garde-fou anti-dérive : resynchronisation quotidienne de l'index Meilisearch
// `profiles` (annuaire /librairies). Auto-heal < 24 h en cas de dérive de
// l'index (historique : disparitions de docs de librairies, 25-28/08).
Schedule::command('scout:import', ['App\\Models\\Profile'])->dailyAt('03:30');

// Rejeu quotidien des settings Meilisearch (filterable/sortable) sur les 4 index
// métier. Idempotent et léger. Auto-heal < 24 h après une restauration de dump
// (le dump via API /dumps peut ne pas réappliquer les settings à l'identique)
// ou une recréation d'index — sans cela, facettes/filtres/tri front se dégradent.
// En cas d'index absent, l'échec est loggé par le scheduler sans impacter les autres.
Schedule::command('books:configure-search')->dailyAt('03:40')->runInBackground();
Schedule::command('listings:configure-search')->dailyAt('03:40')->runInBackground();
Schedule::command('demandes:configure-search')->dailyAt('03:40')->runInBackground();
Schedule::command('profiles:configure-search')->dailyAt('03:40')->runInBackground();

// Supervision de la queue `database` (jobs Scout + mails) : alerte dans les logs
// (critical) si backlog, worker bloqué ou jobs échoués. Ne log rien si tout va bien.
Schedule::command('app:queue-health')->everyFiveMinutes();

// Digest des messages de chat (T3) : UNE notification récapitulative par
// fenêtre X h (réglage admin chat_digest_hours, défaut 6 h). La granularité
// fine est portée par la fenêtre, pas par la fréquence du scheduler.
Schedule::command('notifications:send-chat-digest')->hourly()->runInBackground();

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('make_admin {user}', function (string $user) {
    $userModel = User::find($user);

    if (! $userModel) {
        $this->error("Aucun utilisateur trouve avec l'id: {$user}");

        return self::FAILURE;
    }

    if ($userModel->is_admin) {
        $this->info("L'utilisateur {$userModel->email} (id: {$userModel->id}) est deja admin.");

        return self::SUCCESS;
    }

    if (! $this->confirm("Voulez-vous promouvoir {$userModel->email} (id: {$userModel->id}) admin ?")) {
        $this->info('Operation annulee.');

        return self::SUCCESS;
    }

    $userModel->is_admin = true;
    $userModel->save();

    $this->info("L'utilisateur {$userModel->email} (id: {$userModel->id}) a ete promu admin.");

    return self::SUCCESS;
})->purpose('Promote a user to admin role by user id');

Artisan::command('is_admin {user}', function (string $user) {
    $model = User::find($user);

    if (! $model) {
        $this->error("Aucun utilisateur trouve avec l'id: {$user}");

        return self::FAILURE;
    }

    if ($model->is_admin) {
        $this->info("Oui, {$model->email} (id: {$model->id}) est admin.");
    } else {
        $this->info("Non, {$model->email} (id: {$model->id}) n'est pas admin.");
    }

    return self::SUCCESS;
})->purpose('Check whether a user is admin by id');

Artisan::command('revoke_admin {user}', function (string $user) {
    $model = User::find($user);

    if (! $model) {
        $this->error("Aucun utilisateur trouve avec l'id: {$user}");

        return self::FAILURE;
    }

    if (! $model->is_admin) {
        $this->info("L'utilisateur {$model->email} (id: {$model->id}) n'est pas admin.");

        return self::SUCCESS;
    }

    if (! $this->confirm("Voulez-vous retirer le role admin de {$model->email} (id: {$model->id}) ?")) {
        $this->info('Action annulee.');

        return self::SUCCESS;
    }

    $model->is_admin = false;
    $model->save();

    $this->info("Le role admin a ete retire de {$model->email} (id: {$model->id}).");

    return self::SUCCESS;
})->purpose('Revoke admin role from a user by id');
