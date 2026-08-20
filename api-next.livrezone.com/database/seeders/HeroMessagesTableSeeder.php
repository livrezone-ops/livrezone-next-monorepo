<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class HeroMessagesTableSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $messages = [
            ['language' => 'fr', 'direction' => 'ltr', 'title' => 'Trouvez le livre que vous cherchez', 'description' => "Découvrez un large choix de livres neufs et d'occasion proposés par des librairies et des particuliers partout au Maroc.", 'primary_action_label' => 'Explorer les livres', 'primary_action_href' => '/annonces', 'secondary_action_label' => 'Vendre un livre', 'secondary_action_href' => '/annonces/create', 'sort_order' => 1],
            ['language' => 'fr', 'direction' => 'ltr', 'title' => 'Trouvez un acheteur pour vos livres', 'description' => 'Mettez vos livres en vente sur LivreZone et présentez-les à de nouveaux lecteurs partout au Maroc.', 'primary_action_label' => 'Vendre un livre', 'primary_action_href' => '/annonces/create', 'secondary_action_label' => 'Explorer les livres', 'secondary_action_href' => '/annonces', 'sort_order' => 2],
            ['language' => 'fr', 'direction' => 'ltr', 'title' => "Découvrez les annonces des librairies marocaines", 'description' => 'Parcourez depuis une seule plateforme les livres proposés par différentes librairies au Maroc.', 'primary_action_label' => 'Voir les annonces', 'primary_action_href' => '/annonces', 'secondary_action_label' => 'Vendre un livre', 'secondary_action_href' => '/annonces/create', 'sort_order' => 3],
            ['language' => 'fr', 'direction' => 'ltr', 'title' => 'Des livres pour chaque lecteur', 'description' => "Recherchez des livres neufs et d'occasion dans différentes catégories, villes et gammes de prix.", 'primary_action_label' => 'Découvrir les livres', 'primary_action_href' => '/annonces', 'secondary_action_label' => 'Vendre un livre', 'secondary_action_href' => '/annonces/create', 'sort_order' => 4],
            ['language' => 'ar', 'direction' => 'rtl', 'title' => 'كتابك القادم أقرب مما تتخيل', 'description' => 'اكتشف مجموعة متنوعة من الكتب الجديدة والمستعملة المعروضة من طرف المكتبات والأفراد في جميع أنحاء المغرب.', 'primary_action_label' => 'تصفّح الكتب', 'primary_action_href' => '/annonces', 'secondary_action_label' => 'بِع كتاباً', 'secondary_action_href' => '/annonces/create', 'sort_order' => 5],
            ['language' => 'ar', 'direction' => 'rtl', 'title' => 'اعثر على مشترٍ لكتبك', 'description' => 'اعرض كتبك للبيع على LivreZone وساعدها على الوصول إلى قراء جدد في جميع أنحاء المغرب.', 'primary_action_label' => 'بِع كتاباً', 'primary_action_href' => '/annonces/create', 'secondary_action_label' => 'تصفّح الكتب', 'secondary_action_href' => '/annonces', 'sort_order' => 6],
            ['language' => 'ar', 'direction' => 'rtl', 'title' => 'اكتشف عروض المكتبات المغربية', 'description' => 'تصفّح الكتب التي تقترحها مكتبات مختلفة في المغرب انطلاقاً من منصة واحدة.', 'primary_action_label' => 'شاهد العروض', 'primary_action_href' => '/annonces', 'secondary_action_label' => 'بِع كتاباً', 'secondary_action_href' => '/annonces/create', 'sort_order' => 7],
            ['language' => 'ar', 'direction' => 'rtl', 'title' => 'السوق المغربي للكتب الجديدة والمستعملة', 'description' => 'يجمع LivreZone إعلانات المكتبات والأفراد لمساعدتك على العثور على الكتب أو بيعها في جميع أنحاء المغرب.', 'primary_action_label' => 'ابحث عن كتاب', 'primary_action_href' => '/annonces', 'secondary_action_label' => 'بِع كتاباً', 'secondary_action_href' => '/annonces/create', 'sort_order' => 8],
        ];

        foreach ($messages as $message) {
            DB::table('hero_messages')->updateOrInsert(
                ['id' => $message['sort_order']],
                array_merge($message, [
                    'is_active' => true,
                    'updated_at' => $now,
                    'created_at' => $now,
                ])
            );
        }
    }
}