import ProfileForm from '../../components/ProfileForm';
import PasswordForm from '../../components/PasswordForm';

export default function ProfileSettingsPage() {
    return (
        <div className="space-y-6 pb-12">
            <ProfileForm
                title="Paramètres du profil"
                subtitle="Modifie tes informations personnelles."
            />
            <div className="flex justify-center">
                <PasswordForm />
            </div>
        </div>
    );
}
