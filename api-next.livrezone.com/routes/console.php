<?php

use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

// Expiration des abonnements (downgrade Free + désactivation des annonces excédentaires).
Schedule::command('app:process-subscriptions')->dailyAt('03:00');

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
