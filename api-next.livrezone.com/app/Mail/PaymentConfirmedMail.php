<?php

namespace App\Mail;

use App\Models\Payment;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PaymentConfirmedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public Payment $payment,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Confirmation de votre abonnement – LivreZone',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mails.payment-confirmed',
            with: [
                'plan' => strtoupper($this->payment->subscription_type),
                'period' => ($this->payment->period ?? 'monthly') === 'yearly' ? 'annuel' : 'mensuel',
                'amount' => $this->payment->amount,
                'expiresAt' => $this->payment->expires_at?->format('d/m/Y'),
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
