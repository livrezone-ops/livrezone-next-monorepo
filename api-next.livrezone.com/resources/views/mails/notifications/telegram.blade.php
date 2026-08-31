{{-- Gabarit Telegram STABLE : texte brut formaté (Markdown *gras*), contenu
injecté par NotificationContentService::telegramText(). Aucune logique métier.
ATTENTION : ce gabarit n'est PAS rendu automatiquement par Laravel — le canal
Telegram est envoyé via TelegramNotificationService::sendToChat() avec le
texte produit par le service. Ce fichier documente le format de référence. --}}
📚 *{{ $title }}*
━━━━━━━━━━━━━━━━━━
@foreach ($lines as $line)
@if (trim($line) !== '')
{{ $line }}
@endif
@endforeach
🔗 Lien : {{ $url }}
