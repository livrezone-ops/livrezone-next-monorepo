{{-- Gabarit WhatsApp STABLE : texte brut (pas de Markdown), contenu injecté
par NotificationContentService::whatsappText(). Aucune logique métier.
Référence de format pour WhatsAppNotificationService. --}}
{{ $title }}
@foreach ($lines as $line)
@if (trim($line) !== '')
{{ $line }}
@endif
@endforeach
{{ $url }}
