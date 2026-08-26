<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HeroMessage extends Model
{
    use HasFactory;

    protected $fillable = [
        'language',
        'direction',
        'title',
        'description',
        'primary_action_label',
        'primary_action_href',
        'secondary_action_label',
        'secondary_action_href',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    /**
     * Forme de sortie alignée sur le type HeroMessage du frontend.
     */
    public function toHeroMessageShape(): array
    {
        $shape = [
            'id' => $this->id,
            'language' => $this->language,
            'direction' => $this->direction,
            'title' => $this->title,
            'description' => $this->description,
            'primaryAction' => [
                'label' => $this->primary_action_label,
                'href' => $this->primary_action_href,
            ],
        ];

        if ($this->secondary_action_label && $this->secondary_action_href) {
            $shape['secondaryAction'] = [
                'label' => $this->secondary_action_label,
                'href' => $this->secondary_action_href,
            ];
        }

        return $shape;
    }
}
