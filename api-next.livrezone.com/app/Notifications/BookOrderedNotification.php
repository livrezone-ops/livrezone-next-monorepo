<?php

namespace App\Notifications;

use App\Models\Order;
use App\Services\NotificationContentService;
use App\Support\NotificationChannels;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class BookOrderedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * Canaux Laravel actifs (mail, database). Le canal telegram est géré
     * séparément dans le Job car il nécessite un chat_id par utilisateur.
     *
     * @var array<int, string>
     */
    public array $channels;

    /**
     * Create a new notification instance.
     */
    public function __construct(public Order $order, array $channels)
    {
        $this->channels = $channels;
    }

    /**
     * URL front pour consulter une demande dans l'espace /demandes (recherche
     * par titre, la liste /demandes n'ayant pas de page détail par id).
     */
    public static function demandUrl(string $title): string
    {
        return 'https://next.livrezone.com/demandes?search='.urlencode($title);
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return $this->channels;
    }

    /**
     * Get the mail representation of the notification.
     * Contenu construit par NotificationContentService, gabarit stable
     * mails/notifications/mail.blade.php.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $content = app(NotificationContentService::class)
            ->build('book_orders', $this->toArrayData(), NotificationChannels::MAIL);

        return (new MailMessage)
            ->subject($content['subject'])
            ->view('mails.notifications.mail', [
                'title' => $content['title'],
                'lines' => $content['lines'],
                'cta_label' => $content['cta_label'],
                'url' => $content['url'],
            ]);
    }

    /**
     * Data normalisée pour le service de contenu (titre, auteur, catégorie).
     *
     * @return array<string, mixed>
     */
    protected function toArrayData(): array
    {
        $order = $this->order;

        return [
            'type' => 'book_orders',
            'order_id' => $order->id,
            'title' => $order->title,
            'author' => $order->author ?? 'N/A',
            'category' => $order->category?->name_fr ?? ($order->book?->defaultCategory?->name_fr ?? 'N/A'),
            'message' => "Nouvelle demande de livre : {$order->title}",
            'url' => self::demandUrl($order->title),
        ];
    }

    /**
     * Get the array representation of the notification (canal database / in_app).
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $data = $this->toArrayData();
        $data['link'] = '/demandes?search='.urlencode($this->order->title);

        return $data;
    }
}
