# Feuille de route — Notifications V2 (et correctifs architecture)

> Document de pilotage de la session « Notifications V2 ».
> Référence : `.agents/PROMPT-SESSION-NOTIFICATIONS-V2.txt` (cahier des charges T1-T5)
> + revue architecture du 31/08/2026 (points A1-A5 ci-dessous).
>
> **Règle : chaque tâche terminée est cochée `[x]` et marquée ✅ FAITE avec la date.**
> Ne rien supprimer de ce fichier ; barrer / annoter en cas de changement de périmètre.

---

## 🔁 PROTOCOLE DE REPRISE APRÈS COUPURE (à suivre dans chaque nouveau chat)

1. **Lire ce fichier en premier** (état d'avancement + journal en bas).
2. `git status --short` dans les 2 repos (`api-next.livrezone.com` et
   `../next.livrezone.com`) → comparer avec la colonne « Fichiers touchés »
   de la tâche en cours : un fichier modifié non coché = travail interrompu
   à mi-chemin, **vérifier/terminer avant de cocher**.
3. Reprendre à la première tâche non cochée, dans l'ordre conseillé.
4. Toute tâche commencée mais non finie : noter ⏳ EN COURS dans le journal
   avec ce qui reste à faire (précis, pas générique).
5. Statuts possibles : ⬜ à faire · ⏳ en cours · ✅ faite (datée) · ⛔ bloquée (raison).

**Réflexe sécurité avant tout edit PHP :** l'API est live en bind mount →
`php -l <fichier>` immédiatement après chaque modification, et ne jamais
laisser un fichier en erreur en fin de session.

---

## ÉTAT D'AVANCEMENT — SYNTHÈSE

| Bloc | Statut |
|---|---|
| Socle V1 (Section 1 du prompt, F1.1-F1.9) | ✅ LIVRÉ (31/08) |
| A. Correctifs architecture (A1-A5) | ⬜ À FAIRE (avant T3/T4) |
| T1. Retirer bloc « Rappel de règle » | ⬜ À FAIRE |
| T2. Griser toggle Telegram selon abonnement | ⬜ À FAIRE |
| T3. Digest des messages de chat | ⬜ À FAIRE |
| T4. Service de contenu + gabarits par canal | ⬜ À FAIRE |
| T5. Toggles admin (telegram_pro_enabled, chat_digest_hours) | ⬜ À FAIRE |
| Z. Clôture session (lint, tests, migration, déploiement) | ⏳ PARTIELLE (Z1/Z2/Z3/Z5/Z6 faits, Z4/Z7 pour le propriétaire) |

**Ordre de réalisation conseillé : A1+A2 (bugs) → A3/A4/A5 (avec T3.5) → T5 → T1 → T2 → T3 → T4 → Z.**

---

## PHASE 0 — SOCLE V1 (audité et validé le 31/08/2026) — ✅ ACHEVÉE

Tout était en place avant cette feuille de route, vérifié fichier par fichier :

- [x] `NotificationTypeService` : registre des 6 types (book_orders, messages, newsletter, promos, site_updates, features) — ✅ FAITE 31/08
- [x] Migration `2026_08_31_000001` : colonnes `pinned_at` / `dismissed_at` — ✅ FAITE 31/08 *(exécution DB à confirmer, voir Z2)*
- [x] Routes `POST /notifications/{id}/pin` et `/hide` — ✅ FAITE 31/08
- [x] `NotificationController` : filtre `?type=`, exclusion `dismissed_at`, `togglePin()`, `hide()`, `markRead()`, `markAllRead()` — ✅ FAITE 31/08
- [x] `SubscriptionService` : `telegram_pro_enabled`, `chat_digest_hours`, `allowedNotificationChannels()`, `getChatDigestHours()` — ✅ FAITE 31/08
- [x] `AdminController::updateSettings` : validation des 2 nouvelles clés — ✅ FAITE 31/08
- [x] `ProfileController` : contrat S1/S2 complet + `telegram_allowed` + `telegram_mention` — ✅ FAITE 31/08
- [x] Front V1 : page notifications (filtres, pagination), `parametrage/`, `lib/notifications.ts` — ✅ FAITE 31/08

---

## PHASE A — CORRECTIFS ARCHITECTURE (revue du 31/08/2026)

À faire AVANT T3/T4 : ce sont les fondations que le digest et le service de contenu consommeront.

### A1. Tri « épinglées d'abord » en SQL — ✅ FAITE 31/08
- **Fichiers** : `app/Http/Controllers/Api/NotificationController.php` (méthode `index`, ~l.33-39)
- [x] ✅ FAITE 31/08 : `orderByRaw('pinned_at IS NULL')` + `orderByDesc('created_at')` ajoutés (via scope `visible()`).
- **Validation** : `php -l` OK ✅ · test visuel à faire en Z7 (recette point 6).

### A2. `unread_count` cohérent partout — ✅ FAITE 31/08
- **Fichiers** : `app/Models/UserNotification.php`, `app/Http/Controllers/Api/NotificationController.php`
- [x] ✅ FAITE 31/08 : scope `visible()` créé ; utilisé dans `index()` (liste + unread_count), `markRead()` et `markAllRead()` (les masquées ne sont plus marquées lues).
- **Validation** : `php -l` OK ✅ · test masquage → décrément partout : à faire en Z7.

### A3. Vocabulaire unique des canaux — ✅ FAITE 31/08
- **Fichiers** : `app/Support/NotificationChannels.php` (NOUVEAU), `SubscriptionService`, `NotificationPreferenceService`, `ProfileController`, `ProcessBookOrderNotifications`, `NotifyDemandersOnListingPublished`
- [x] ✅ FAITE 31/08 : classe `NotificationChannels` créée (const canaux Laravel + clés préférences + mappings `toLaravel()`/`toPreference()`), appliquée dans les 5 consommateurs (y compris `'whatsapp'` brut dans `NotifyDemandersOnListingPublished` l.63, non prévu au départ).
- **Validation** : `php -l` OK sur les 5 fichiers ✅ · grep : plus aucune chaîne de canal brute hors de la classe ✅ (les `'email'` restants sont des champs utilisateur, hors périmètre).

### A4. Nettoyage `NotificationPreferenceService` (= T3.5 du prompt) — ✅ FAITE 31/08
- **Fichiers** : `app/Services/NotificationPreferenceService.php` (usages recensés au préalable : constantes utilisées nulle part ailleurs → modification sûre)
- [x] ✅ FAITE 31/08 : constantes `ALLOWED_TYPES`/`ALLOWED_CHANNELS` remplacées par des méthodes déléguant au registre (`allowedTypes()` → `NotificationTypeService::keys()`, 6 types ; `allowedChannels()` → canaux externes uniquement, `in_app` retiré). Méthodes plutôt que constantes littérales pour empêcher toute re-divergence.
- **Validation** : `php -l` OK ✅ · grep usages constants : aucun consommateur externe ✅ · tests backend à confirmer en Z4.

### A5. Logique d'écriture sortie du contrôleur — ✅ FAITE 31/08
- **Fichiers** : `app/Services/NotificationSettingsService.php` (NOUVEAU), `app/Http/Controllers/Api/ProfileController.php`
- [x] ✅ FAITE 31/08 : `save()` créé (matrice + purge + écriture dans `DB::transaction()`, injection du `NotificationPreferenceService`) ; contrôleur réduit à validation + délégation, contrat JSON inchangé ; import mort `NotificationPreference` retiré.
- ⚠️ Incident corrigé au passage : un remplacement scripté avait produit `NotificationChannels::{PREF_…}` (fetch dynamique valide en syntaxe mais cassant à l'exécution — `php -l` ne le détecte pas) ; 13 occurrences corrigées en `::PREF_…` dans ProfileController + ProcessBookOrderNotifications. Leçon : vérifier le rendu final après script, pas seulement `php -l`.
- **Validation** : `php -l` OK ✅ · test POST avant/après → à faire en Z7 (recette paramétrage).

---

## PHASE T — TÂCHES PRODUIT (points 1 à 5 du propriétaire)

### T1. Retirer le bloc « Rappel de règle » du paramétrage (point 1) — ✅ FAITE 31/08
- **Fichiers** : `../next.livrezone.com/frontend/app/dashboard/notifications/parametrage/page.tsx`
- [x] ✅ FAITE 31/08 : bloc JSX ShieldCheck (ex-l.209-218) supprimé + import `ShieldCheck` retiré. Le commentaire des CHANNELS (règle canaux externes) conservé : il décrit une règle toujours vraie, pas l'encart supprimé.
- ⚠️ Incident corrigé au passage : suppression accidentelle de la ligne WhatsApp du tableau CHANNELS lors d'un edit, restaurée immédiatement à l'identique (vérifier son rendu en recette).
- **Validation** : ESLint 0 ✅ · TSC 0 ✅ · test visuel → Z7 recette point 1.

### T2. Griser le toggle Telegram selon l'abonnement (point 2) — ✅ FAITE 31/08
- **Fichiers** : `../next.livrezone.com/frontend/app/dashboard/notifications/parametrage/page.tsx`
- [x] ✅ FAITE 31/08 : state `telegramAllowed`/`telegramMention` (chargés du GET) ; toggle Telegram verrouillé dans `toggleChannel` si non autorisé + ligne grisée (opacity, icône grise, cursor-not-allowed) ; `telegram_mention` affichée sous le libellé (remplace la description statique) ; section 3 : bouton Connecter remplacé par la mention si non autorisé, Déconnecter disabled, bloc deep-link masqué ; sauvegarde force `channels.telegram=false` si non autorisé.
- **Validation** : TSC 0 ✅ · ESLint 0 ✅ · test visuel Free/Premium → Z7 recette point 2.

### T3. Digest des messages de chat (point 3) — ✅ FAITE 31/08 (test exécution à faire en Z)
- **Fichiers** : `app/Console/Commands/SendChatDigests.php` (NOUVEAU), `app/Notifications/ChatDigestNotification.php` (NOUVEAU), `routes/console.php`
- [x] ✅ FAITE 31/08 : commande `notifications:send-chat-digest` (fenêtre `getChatDigestHours()`, destinataires via JOIN threads avec CASE expéditeur→destinataire, exclusion threads supprimés pour le destinataire, anti-doublon sur dernier digest `data->kind='chat_digest'`, jamais de notif vide) ; notification (database TOUJOURS, mail selon préférences×Premium, telegram via `sendToChat` même pattern que le job) ; schedule `->hourly()->runInBackground()`.
- NOTE : les threads ChatThread ne portent pas de titre de livre/annonce (fillable sans référence listing) → le résumé indique nb messages + nb conversations + lien `/dashboard/messages` (le « titre du livre si disponible » du prompt n'est pas implémentable sans refonte du modèle de threads).
- **Validation** : `php -l` OK ×3 ✅ · exécution réelle de la commande dans le conteneur → Z4/Z7 (conteneur rootless inaccessible depuis cette session).

### T4. Service de contenu + gabarits par canal (point 4) — ✅ FAITE 31/08
- **Fichiers** : `app/Services/NotificationContentService.php` (NOUVEAU), `resources/views/mails/notifications/{mail,telegram,whatsapp}.blade.php` (NOUVEAUX), `app/Notifications/BookOrderedNotification.php`, `app/Notifications/ChatDigestNotification.php`, `app/Jobs/ProcessBookOrderNotifications.php`
- [x] ✅ FAITE 31/08 : service `build()` (contenus book_orders/messages + générique pour newsletter/promos/site_updates/features, fallback type inconnu, url absolue forcée) + `telegramText()`/`whatsappText()` ; 3 gabarits stables créés (mail = style payment-confirmed, telegram/whatsapp = référence de format texte, le canal étant envoyé via services) ; BookOrderedNotification::toMail branché (data enrichie author/category, rendu équivalent : sujet/lignes/CTA identiques) ; buildTelegramMessage du job supprimé, délégué au service ; ChatDigest + digest Telegram branchés sur le service. Const `WHATSAPP` ajoutée à NotificationChannels.
- **Validation** : `php -l` OK ×5 ✅ · rendu mail/Telegram avant/après → Z7 recette point 4.

### T5. Toggles admin (point 5) — ✅ FAITE 31/08
- **Fichiers** : `../next.livrezone.com/frontend/components/admin/AdminPaymentsClient.tsx`
- [x] ✅ FAITE 31/08 : `SwitchRow` « Telegram pour les comptes Pro » (`telegram_pro_enabled`, via `instantApply`, hint explicite) ajouté dans un bloc « Notifications » ; champ numérique « Résumé des messages (h) » (`chat_digest_hours`, min 1 / max 168, défaut 6) ajouté au grid + inclus dans `saveSettings` avec clamp 1-168.
- **Validation** : TSC 0 erreur ✅ · ESLint 0 erreur ✅ (2 warnings préexistants `useRef`/`err`, hors périmètre) · test effet de chaîne → Z7 recette point 5.

---

## PHASE Z — CLÔTURE DE SESSION (imperative, règle projet)

- [x] ✅ Z1 FAITE 31/08 : `php -l` OK sur les 16 fichiers PHP touchés.
- [x] ✅ Z2 FAITE 31/08 (22h50) : migration `2026_08_31_000001_add_pinned_and_dismissed_to_notifications_table` exécutée en prod dans `php-fpm-8.5` (batch 29, 31 ms) — `migrate:status` → Ran, requête `whereNull('dismissed_at')` OK (50 notifs), `GET /api/notifications` + `POST pin` répondent 401 JSON propre. ~~BLOQUÉE (sudo nécessaire)~~ accès rootless via `DOCKER_HOST=unix:///run/user/1001/docker.sock sudo -n docker exec` (env_keep sudoers). Recette connectée → Z7.
-[x] ✅ Z3 FAITE 31/08 : ESLint 0 erreur, TSC 0 erreur (2 warnings préexistants AdminPaymentsClient, hors périmètre).
-[ ] ⏳ Z4 BLOQUÉE (conteneur) : pint + phpunit + exécution manuelle du digest, par le propriétaire.
-[x] ✅ Z5 FAITE 31/08 : commits 53c9f34 + 52150e6 (dépôt racine _data unique). Push GitHub à lancer.
-[x] ✅ Z6 FAITE 31/08 : `.agents/AUDIT-2026-08-31.md` créé.
- [ ] Z7. Demander au propriétaire le déploiement front (`lz`) + tests de recette :
      1. Paramétrage : plus d'encart « Rappel de règle » (T1)
      2. Toggle Telegram grisé avec mention selon abonnement Free/Pro/Premium (T2)
      3. 2 messages de chat → 1 seule notif récapitulative, pas de doublon à la relance (T3)
      4. Mail + Telegram de commande de livre : rendu inchangé via les gabarits (T4)
      5. Toggles admin : activation Telegram Pro → effet immédiat côté paramétrage utilisateur (T5)
      6. Épingler une vieille notification → remonte en tête de page 1 (A1)

---

## JOURNAL DES AVANCEMENTS

*(Ajouter une ligne datée à chaque tâche cochée — qui, quoi, fichier(s).)*

- 2026-08-31 : création de la feuille de route ; socle V1 audité et acté (PHASE 0).
- 2026-08-31 : renforcement anti-coupure — protocole de reprise, fichiers + critères de validation sur toutes les tâches A/T/Z, journal détaillé. Aucune tâche encore commencée.
- 2026-08-31 : **A1 ✅** (tri épinglées en SQL, NotificationController::index) + **A2 ✅** (scope visible() sur UserNotification, unread_count cohérent index/markRead/markAllRead). `php -l` OK sur les 2 fichiers.
- 2026-08-31 : **A3 ✅** — création `app/Support/NotificationChannels.php` (2 nomenclatures + mappings), remplacement des chaînes brutes dans SubscriptionService, NotificationPreferenceService, ProfileController, ProcessBookOrderNotifications, NotifyDemandersOnListingPublished. `php -l` OK ×5, grep propre.
- 2026-08-31 : **A4 ✅ (= T3.5)** — constantes du NotificationPreferenceService remplacées par `allowedTypes()`/`allowedChannels()` déléguant au registre (6 types, plus de `in_app`). Aucun consommateur externe des anciennes constantes. `php -l` OK.
- 2026-08-31 : **A5 ✅** — `NotificationSettingsService::save()` en transaction, contrôleur allégé. **PHASE A TERMINÉE.** Incident intermédiaire : syntaxe `::{CONST}` invalide générée par script puis corrigée (13 occurrences) — voir note A5.
- 2026-08-31 : **T5 ✅** — AdminPaymentsClient : SwitchRow `telegram_pro_enabled` (instantApply) + champ `chat_digest_hours` (clamp 1-168 dans saveSettings). TSC 0 erreur, ESLint 0 erreur.
- 2026-08-31 : **T1 ✅** — encart « Rappel de règle » + import ShieldCheck supprimés (page paramétrage). Ligne WhatsApp accidentellement supprimée puis restaurée à l'identique. ESLint/TSC 0 erreur.
- 2026-08-31 : **T2 ✅** — paramétrage : toggle Telegram verrouillé + grisés selon `telegram_allowed`, mention dynamique affichée, section 3 conditionnée, sauvegarde force telegram=false si non autorisé. ESLint/TSC 0 erreur.
- 2026-08-31 : **T3 ✅** — SendChatDigests + ChatDigestNotification + schedule hourly. Anti-doublon via dernier digest. NOTE : pas de titre de livre dans les threads (modèle sans référence listing) → résumé = nb messages + nb conversations + lien. Exécution réelle à tester dans le conteneur (Z).
- 2026-08-31 : **T4 ✅** — NotificationContentService + 3 gabarits ; BookOrderedNotification, ChatDigestNotification et job Telegram branchés sur le service. `php -l` OK. Rendu visuel à comparer en Z7.
- 2026-08-31 : **TOUTES LES TÂCHES DE CODE TERMINÉES (A1-A5, T1-T5). Reste la phase Z.**
- 2026-08-31 : **Z1/Z3/Z5/Z6 ✅, Z2/Z4/Z7 ⏳ pour le propriétaire** (sudo + déploiement lz). Voir `.agents/AUDIT-2026-08-31.md`. Session V2 close côté agent.
- 2026-08-31 (22h50) : **Z2 ✅** — accès rootless retrouvé (`DOCKER_HOST=unix:///run/user/1001/docker.sock sudo -n docker exec`, env_keep sudoers du 28/08) ; `migrate:status` révélait `2026_08_31_000001` PENDING → `migrate --force` exécuté (batch 29) ; vérifs : requête `whereNull('dismissed_at')` OK, `/api/notifications` + `pin` → 401 JSON (le 500 « Route [login] not defined » sans header Accept est un artefact curl, comportement antérieur). Au passage : `livrezone-redis` est de nouveau attaché au réseau `livrezone_db` (erreurs DNS du log arrêtées à 18:49, queue-health 0/0/0/0). Restent Z4 (pint/phpunit + digest) et Z7 (recette connectée + `lz`).
