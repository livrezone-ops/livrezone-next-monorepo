import ProfileForm from '../../../components/ProfileForm';

export default function CompleteProfilePage() {
    return (
        <ProfileForm
            title="Compléter mon profil"
            subtitle="Ces informations permettent de personnaliser ton expérience LivreZone."
            redirectPath="/dashboard"
        />
    );
}
