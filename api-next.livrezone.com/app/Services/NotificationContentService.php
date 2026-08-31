<?php

namespace App\Services;

/**
 * Contenu des notifications par TYPE (source unique), gabarits stables par
 * CANAL (resources/views/mails/notifications/). Un nouveau type = un bloc
 * de contenu ici, aucun nouveau blade.
 *
 * API : build(type, data, canal) -> ['subject', 'title', 'lines', 'cta_label', 'url']
 * + telegramText() / whatsappText() pour les canaux texte brut.
 * Fallback générique pour tout type inconnu (ne jamais crasher).
 */
class NotificationContentService
{
    /**
     * Construit le contenu d'une notification pour un type et un canal donnés.
     *
     * @param  array<string, mixed>  $data  data de la notification Laravel
     * @param  string  $channel  canal Laravel (mail, telegram, whatsapp, database)
     * @return array{subject: string, title: string, lines: array<int, string>, cta_label: string, url: string}
     */
    public function build(string $type, array $data, string $channel = NotificationChannels::MAIL): array
    {
        $url = isset($data['url']) && is_string($data['url'])
            ? (str_starts_with($data['url'], 'http') ? $data['url'] : 'https://next.livrezone.com'.$data['url'])
            : 'https://next.livrezone.com/dashboard/notifications';

        return match ($type) {
            'book_orders' => $this->bookOrders($data, $url, $channel),
            'messages' => $this->messages($data, $url, $channel),
            'newsletter' => $this->generic($data, $url, 'Lire la newsletter'),
            'promos' => $this->generic($data, $url, 'Voir l\'offre'),
            'site_updates' => $this->generic($data, $url, 'Voir les détails'),
            'features' => $this->generic($data, $url, 'Découvrir'),
            default => $this->generic($data, $url, 'Voir sur LivreZone'),
        };
    }

    /**
     * Texte Telegram (formatage *gras* + emoji, style du job des demandes).
     */
    public function telegramText(string $type, array $data): string
    {
        $c = $this->build($type, $data, NotificationChannels::TELEGRAM);
        $lines = implode("\n", array_map(fn (string $line): string => $line, $c['lines']));
        $sep = "━━━━━━━━━━━━━━━━━━\n";

        return "📚 *{$c['title']}*\n{$sep}{$lines}\n🔗 Lien : {$c['url']}";
    }

    /**
     * Texte WhatsApp (texte brut, pas de Markdown).
     */
    public function whatsappText(string $type, array $data): string
    {
        $c = $this->build($type, $data, NotificationChannels::WHATSAPP);
        $lines = implode("\n", $c['lines']);

        return "{$c['title']}\n{$lines}\n{$c['url']}";
    }

    /**
     * Type book_orders : demande de livre (data du BookOrderedNotification).
     *
     * @param  array<string, mixed>  $data
     * @return array{subject: string, title: string, lines: array<int, string>, cta_label: string, url: string}
     */
    protected function bookOrders(array $data, string $url, string $channel): array
    {
        $title = (string) ($data['title'] ?? 'Livre');
        $author = $data['author'] ?? null;
        $category = $data['category'] ?? null;

        $lines = [
            "Un utilisateur cherche le livre suivant sur LivreZone :",
            $title,
        ];
        if ($author !== null) {
            $lines[] = 'Auteur : '.(string) $author;
        }
        if ($category !== null) {
            $lines[] = 'Catégorie : '.(string) $category;
        }

        return [
            'subject' => "Nouvelle demande de livre : {$title}",
            'title' => 'Nouvelle demande de livre',
            'lines' => $lines,
            'cta_label' => 'Voir la demande',
            'url' => $url,
        ];
    }

    /**
     * Type messages : digest de chat (data du ChatDigestNotification).
     *
     * @param  array<string, mixed>  $data
     * @return array{subject: string, title: string, lines: array<int, string>, cta_label: string, url: string}
     */
    protected function messages(array $data, string $url, string $channel): array
    {
        $message = (string) ($data['message'] ?? 'Vous avez de nouveaux messages.');

        return [
            'subject' => 'Vous avez de nouveaux messages',
            'title' => (string) ($data['title'] ?? 'Nouveaux messages'),
            'lines' => [$message],
            'cta_label' => 'Lire mes messages',
            'url' => $url,
        ];
    }

    /**
     * Fallback générique (aussi utilisée par newsletter/promos/site_updates/
     * features tant qu'aucun sender dédié n'existe).
     *
     * @param  array<string, mixed>  $data
     * @return array{subject: string, title: string, lines: array<int, string>, cta_label: string, url: string}
     */
    protected function generic(array $data, string $url, string $ctaLabel): array
    {
        $title = (string) ($data['title'] ?? 'Notification LivreZone');

        return [
            'subject' => (string) ($data['subject'] ?? $title),
            'title' => $title,
            'lines' => [(string) ($data['message'] ?? '')],
            'cta_label' => $ctaLabel,
            'url' => $url,
        ];
    }
}
