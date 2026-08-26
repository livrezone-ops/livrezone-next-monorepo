<?php

namespace App\Notifications;

use App\Models\Order;
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
     */
    public function toMail(object $notifiable): MailMessage
    {
        $order = $this->order;
        $category = $order->category?->name_fr ?? ($order->book?->defaultCategory?->name_fr ?? 'N/A');

        return (new MailMessage)
            ->subject("Nouvelle demande de livre : {$order->title}")
            ->greeting("Bonjour {$notifiable->name},")
            ->line('Un utilisateur cherche le livre suivant sur LivreZone :')
            ->line("**{$order->title}**")
            ->line('Auteur : '.($order->author ?? 'N/A'))
            ->line("Catégorie : {$category}")
            ->action('Voir la demande', url('/annonces'))
            ->line('Merci de votre confiance.');
    }

    /**
     * Get the array representation of the notification (canal database / in_app).
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $order = $this->order;

        return [
            'type' => 'book_orders',
            'order_id' => $order->id,
            'title' => $order->title,
            'message' => "Nouvelle demande de livre : {$order->title}",
            'link' => '/annonces',
        ];
    }
}
