{{-- Gabarit e-mail STABLE des notifications LivreZone : le contenu (titre,
lignes, CTA, url) est injecté par App\Services\NotificationContentService.
AUCUNE logique métier par type ici — style inspiré de payment-confirmed. --}}
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;background:#f5f3ff;font-family:Arial,Helvetica,sans-serif;padding:24px 0;">
    <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td align="center">
                <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(109,40,217,0.12);">
                    <tr>
                        <td style="background:#6D28D9;padding:28px 32px;">
                            <span style="color:#ffffff;font-size:22px;font-weight:700;">LivreZone</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:32px;">
                            <h1 style="color:#1f2937;font-size:20px;margin:0 0 16px;">{{ $title }}</h1>
                            <div style="background:#f9fafb;border-radius:12px;margin-bottom:24px;">
                                <div style="padding:16px 20px;color:#374151;font-size:14px;line-height:2;">
                                    @foreach ($lines as $line)
                                        @if (trim($line) !== '')
                                            {{ $line }}<br>
                                        @endif
                                    @endforeach
                                </div>
                            </div>
                            <a href="{{ $url }}"
                               style="display:inline-block;background:#6D28D9;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:12px;">
                                {{ $cta_label }}
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td style="background:#f9fafb;padding:18px 32px;">
                            <p style="color:#9ca3af;font-size:11px;margin:0;">
                                Vous recevez cet e-mail car vous avez un compte LivreZone. Gérez vos préférences
                                dans le paramétrage des notifications de votre espace.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
