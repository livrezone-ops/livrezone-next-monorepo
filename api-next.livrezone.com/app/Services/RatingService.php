<?php

namespace App\Services;

use App\Models\Profile;
use App\Models\Rating;
use App\Models\User;

class RatingService
{
    /**
     * Enregistre ou met à jour un avis et recalcule les statistiques du profil.
     *
     * @param User $user
     * @param Profile $profile
     * @param int $score
     * @param string|null $comment
     * @return Rating
     * @throws ValidationException
     */
    public function storeRating(User $user, Profile $profile, int $score, ?string $comment = null): Rating
    {
        // Interdiction de l'auto-évaluation
        if ($profile->user_id === $user->id) {
            abort(403, "Vous ne pouvez pas évaluer votre propre profil.");
        }

        // Sauvegarde de l'avis
        $rating = Rating::updateOrCreate(
            ['user_id' => $user->id, 'profile_id' => $profile->id],
            ['score' => $score, 'comment' => $comment]
        );

        // Calcul de la moyenne et du compteur (sans observer)
        $average = Rating::where('profile_id', $profile->id)->avg('score') ?? 0;
        $count = Rating::where('profile_id', $profile->id)->count();

        // Mise à jour explicite (compteurs retirés de $fillable pour éviter
        // tout mass assignment).
        $profile->rating_average = $average;
        $profile->rating_count = $count;
        $profile->save();

        return $rating;
    }
}
