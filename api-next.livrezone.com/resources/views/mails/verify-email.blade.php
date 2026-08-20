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
                            <h1 style="color:#1f2937;font-size:20px;margin:0 0 16px;">Bonjour {{ $name }},</h1>
                            <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 24px;">
                                Merci de rejoindre LivreZone&nbsp;! Confirmez votre adresse email pour activer votre
                                compte et accéder à votre bibliothèque et à vos annonces.
                            </p>
                            <a href="{{ $url }}" style="display:inline-block;background:#6D28D9;color:#ffffff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:10px;font-size:15px;">Confirmer mon email</a>
                            <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:24px 0 0;">
                                Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur&nbsp;:<br>
                                <span style="color:#6D28D9;word-break:break-all;">{{ $url }}</span>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
