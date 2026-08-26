<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class VerifyEmailMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $url,
        public string $name,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Confirmez votre adresse email – LivreZone',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mails.verify-email',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
