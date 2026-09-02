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
| A. Correctifs architecture (A1-A5) | ✅ FAITS (31/08) |
| T1. Retirer bloc « Rappel de règle » | ✅ FAIT (31/08) |
| T2. Griser toggle Telegram selon abonnement | ✅ FAIT (31/08 + affine 01/09 : forcé OFF) |
| T3. Digest des messages de chat | ✅ FAIT (31/08 + test prod Z4 le 01/09) |
| T4. Service de contenu + gabarits par canal | ✅ FAIT (31/08) |
| T5. Toggles admin (telegram_pro_enabled, chat_digest_hours) | ✅ FAITS (31/08) |
| Retours propriétaire 01/09 (points 1, 1 bis, 2, 2 bis) | ✅ FAITS (01/09) |
| Z. Clôture session (lint, tests, migration, déploiement) | ⏳ Z1-Z6 ✅, Z4 ✅ (01/09), `lz` ✅ — **reste Z7 uniquement** |

**Ordre de réalisation conseillé : A1+A2 (bugs) → A3/A4/A5 (avec T3.5) → T5 → T1 → T2 → T3 → T4 → Z.** *(historique : tout est réalisé sauf Z7)*

---

## 🎯 PROCHAINES ÉTAPES (état au 01/09/2026)

### Immédiat — Notifications V2

1. **Z7 — Recette front connectée sur la prod** *(propriétaire ; déploiement `lz` déjà fait)*
   Checklist de validation :
   - [ ] `/dashboard/notifications/parametrage` : encart « Rappel de règle » absent (T1) ;
   - [ ] toggle Telegram **grisé et forcé en position désactivée** pour un compte non
     éligible (`telegram_allowed=false`), actif pour un compte autorisé (T2 + 01/09) ;
   - [ ] sous-bloc **« Paramétrer Telegram sur téléphone »** visible uniquement quand le
     toggle Telegram est activé (connexion, deep-link, copier, déconnecter) ;
   - [ ] titres de sections : « Recevoir des notifications par : » / « Recevoir des
     notifications par rapport à » ; libellés « Demandes de livre » / « Les messages du chat » ;
   - [ ] `/dashboard/notifications` : vues tableau ↔ cartes commutables (comme le
     dashboard), pagination fenêtrée, « Tout marquer comme lu » ;
   - [ ] épingler une vieille notification → remonte en tête de page 1 (A1) ;
   - [ ] masquer une notification → **modale de confirmation**, puis disparition de la
     liste et décrément du badge non-lues (A2) ;
   - [ ] toggles admin (`telegram_pro_enabled`, `chat_digest_hours`) → effet immédiat
     côté paramétrage d'un compte Pro (T5) ;
   - [ ] mail + Telegram d'une commande de livre : rendu inchangé via les gabarits (T4).

2. **🔴 URGENT — Bascule du mailing sur Amazon SES** *(côté Amazon : OK — reste le
   paramétrage serveur)*
   - [x] **SDK AWS absent de `composer.json`** (vérifié 01/09, Laravel ^13.8 :
     mailer SES natif) → ✅ **FAIT 01/09** : `composer require aws/aws-sdk-php` dans le conteneur
      (v3.394.6, `^3.394`) — `package:discover` OK, artisan boote (Laravel
      13.24.0), `vendor/aws/` présent ; composer.json + composer.lock commités ;
   - [x] Variables `.env` prod : `MAIL_MAILER=ses`, `AWS_ACCESS_KEY_ID` /
     `AWS_SECRET_ACCESS_KEY` (utilisateur IAM dédié avec policy SES restreinte
     à l'envoi), `AWS_DEFAULT_REGION` (région de l'identité SES validée),
     `MAIL_FROM_ADDRESS` (identité vérifiée SES) — le `.env.example` actuel
     (vérifié 01/09) est encore en `MAIL_MAILER=log` sans bloc `AWS_*` →
     le mettre à jour également ;
      ✅ **FAIT 02/09 (variante SMTP SES)** : les identifiants fournis par le
      propriétaire sont des **identifiants SMTP SES** (incompatibles avec le
      mailer SDK `ses`, qui exige une clé d'accès IAM brute) → prod basculée
      sur le **relais SMTP SES** `email-smtp.eu-west-3.amazonaws.com:587/TLS`
      (IAM `ses-smtp-user.20260902-004919`), `MAIL_FROM_ADDRESS=no-reply@livrezone.com`,
      région corrigée `us-east-1` → `eu-west-3`, sauvegarde `.env.bak-20260902-ses` ;
      `.env.example` à jour (commit 62b096e) ; le mailer SDK `ses` reste
      activable plus tard (SDK installé, point 1) si clé IAM générée ;
   - [ ] DNS du domaine : enregistrements **SPF + DKIM** (CNAME fournis par SES)
     pour l'authentification — ⏳ **EN COURS 02/09 (matin)** : identité domaine
      `livrezone.com` (eu-west-3) désormais **VÉRIFIÉE côté SES** (envoi accepté,
      cohérent avec le flux DKIM-only : pas de TXT `_amazonses` visible) et le
      propriétaire confirme avoir publié les CNAME DKIM dans **Cloudflare** →
      reste : vérification de propagation depuis le conteneur (`dns_get_record`,
      il faut les 3 noms d'hôte CNAME exacts fournis par le propriétaire) ;
      ⚠️ **SPF toujours absent** (TXT apex = seul code Brevo) → à ajouter
      (`v=spf1 include:amazonses.com -all`, fusionné avec Brevo si conservé) ;
   - [ ] Sortir du sandbox SES si nécessaire (demande de quota de production) —
      ⛔ **BLOQUANT, preuve 02/09 (matin)** : envoi réel vers une adresse externe
      NON vérifiée (`peecota@hotmail.com`) rejeté par SES (`554 Message rejected:
      Email address is not verified … peecota@hotmail.com`) → SES est **toujours
      en sandbox** ; à faire par le propriétaire : console SES →
      « Request production access » ;
   - [x] Vider le cache de config : `artisan config:clear` (API live en bind mount) — ✅ FAIT 02/09 ;
   - [ ] Test d'envoi réel (forgot-password) + vérifier les files (`queue:monitor`)
     et `app:queue-health` vert ; cocher au passage le « test e-mail réel » ouvert
     depuis le 26/08 — ⏳ **EN COURS 02/09** : `554` initial (identité non
      vérifiée) puis **envoi réel SES RÉUSSI** (`Mail::raw` « Test SES LivreZone
      #2 » → `contact@livrezone.com`, `ENVOI-OK`) — l'identité d'expédition est
      vérifiée ; **test forgot-password réel exécuté 02/09 (matin)** sur le
      compte #12 (`peecota@hotmail.com`, accord du propriétaire) via
      `POST /api/auth/forgot-password` (flow custom du projet :
      `AuthController@forgotPassword` + `ResetPasswordMail` en queue — NE PAS
      utiliser `Password::sendResetLink` direct, cf. journal) : API répond OK,
      le worker traite le job, **SES rejette `554` (sandbox, voir point 4)** →
      job échoué #18 dans `failed_jobs`, à re-trier (`php artisan queue:retry 18`)
      après la sortie du sandbox (le lien de reset partira alors tout seul) ;
      **`app:queue-health`** : 0 en attente / 0 bloqué / **1 échoué (#18)** ;
   - [ ] Surveiller le dashboard SES (bounces/complaints) pendant 24-48 h.

3. **Clôture de la session** *(agent, après recette)*
   - [ ] Cocher Z7 dans la roadmap + section audit, statut final « SESSION CLOSE » ;
   - [ ] push final.

### Court terme — rapporté des audits 25-26/08 (hors périmètre Notifications V2)

- [ ] **Intégration CMI/Fatourati** dans `PaymentGatewayService` (initiate +
      signature webhook) — ⚠️ **pas de compte CMI/Fatourati valide dans l'immédiat**,
      mais **réalisable sans compte valide** : développer contre le simulateur
      existant (`PAYMENT_SIMULATOR`) + gabarits des contrats CMI/Fatourati
      (payload initiate, signature HMAC, webhook idempotent), toggles admin déjà
      en place ; bascule réelle au moment de l'obtention du compte (config seule).
      → **peut être priorisé dès maintenant** ;
- [ ] **Optimisation images Next + AbortController systématique** ;
- [ ] **Form Requests** pour les controllers Profile/Auth/Admin restants +
      fusion store/update complète ;
- [ ] **Factories métier + tests Auth/OAuth** ;
- [ ] **Repasser les 3 règles React Compiler en `error`** (après refactoring des
      monolithes front — fin de la dette lint) ;
- [ ] Poser les 4 variables `WHATSAPP_*` dans le `.env` prod si le canal WhatsApp
      doit être activé (`WHATSAPP_ENABLED`, `WHATSAPP_API_KEY`, `WHATSAPP_API_URL`, …).

### Long terme (vision, non planifié)

- [ ] API `/v1`, découpage des monolithes front, monitoring/alerting,
      centralisation des URLs front, gestionnaire `.env` complet
      (dont page admin de gestion des settings — sécurité forte, à traiter en dernier).

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
-[x] ✅ Z4 FAITE 01/09 (agent, accès rootless) : pint `--test` → 15 écarts (dont les fichiers V2) → corrigés, re-test **PASS 209 fichiers** ; phpunit **OK 84 tests / 257 assertions** (après correctifs) ; `notifications:send-chat-digest` exécuté 2× en prod → « Aucun destinataire éligible (fenêtre 6 h) » les deux fois (aucun message de chat non lu : cas vide OK, pas de crash ; le scénario complet 2 messages → 1 notif est couvert par la suite phpunit).
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
- 2026-09-01 : **POINT 1 (retour propriétaire) ✅** — la page /notifications du front
  (`next.livrezone.com/frontend/app/dashboard/notifications/page.tsx`) n'exposait pas
  les actions V2 : liste en cartes, sans boutons épingler/masquer (alors que les
  endpoints `POST /notifications/{id}/pin` et `/hide` existaient côté API).
  Refonte : liste en **tableau** (colonnes Titre de notification / Date / Type /
  Actions avec 2 boutons : épingler-désépingler et masquer), badge épinglée,
  « Marquer comme lu » conservé pour les notifs non cliquables. Pagination :
  déjà en place (fenêtrée), confirmée inchangée. Lib : `pinned_at` ajouté à
  `AppNotification` + helpers `notificationTypeKey()`/`notificationTypeLabel()`
  (`lib/notifications.ts`). TSC 0 erreur, ESLint 0 erreur.
- 2026-09-01 : **POINT 1 bis (retours propriétaire) ✅** — page /notifications affinée :
  (1) plus aucun scroll horizontal — tableau en `table-fixed` avec colonnes dimensionnées ;
  (2) bouton « Marquer comme lu » présent dans les DEUX vues ;
  (3) deux vues commutables exactement comme le dashboard (segmented control
  `Grid`/`List` dans l'en-tête de la boîte, `viewMode` "table" par défaut,
  cartes visibles sur mobile même en mode tableau) ;
  vue cartes = grille 2 à 3 cartes par ligne (`grid-cols-1 sm:grid-cols-2
  lg:grid-cols-3`), badge type + épinglée + titre + aperçu + date + pied de
  carte (Marquer comme lu / Lue + épingler + masquer, stopPropagation) ;
  (4) « Tout marquer comme lu » re-stylé en bouton bordé visible (il existait
  déjà, apparait quand il y a des non-lues) ;
  (5) pagination re-stylée comme le dashboard (boutons bordés px-3 py-2) ;
  conteneur élargi max-w-3xl → max-w-5xl. TSC 0 erreur, ESLint 0 erreur.
- 2026-09-01 : **POINT 2 (retours propriétaire) ✅** — page
  /dashboard/notifications/parametrage : (1) toggle Telegram grisé ET forcé en
  position désactivée pour les comptes non éligibles (`telegram_allowed=false`,
  il gardait auparavant sa position enregistrée) ; (2) titres de sections
  renommés : « Recevoir des notifications par : » (S1) et « Recevoir des
  notifications par rapport à » (S2) ; (3) ancienne section 3 supprimée, son
  contenu devient le sous-bloc « Paramétrer Telegram sur téléphone » imbriqué
  en fin de S1, visible uniquement quand le toggle Telegram est activé ;
  libellés S2 : « Demandes de livre » / « Les messages du chat »
  (lib/notifications.ts, partagés). TSC 0 erreur, ESLint 0 erreur.
- 2026-09-01 : **POINT 2 bis (retour propriétaire) ✅** — confirmation avant
  masquage d'une notification (page /notifications) : modale identique au
  design du dashboard (overlay blur, pastille rose EyeOff, Annuler / Confirmer),
  déclenchée depuis les boutons Masquer des vues tableau ET cartes ;
  épinglage et « Marquer comme lu » restent immédiats. Recette propriétaire
  validée (« tout est en place correctement »). TSC 0 erreur, ESLint 0 erreur.
- 2026-09-01 : **`lz` ✅ (propriétaire)** — déploiement front effectué : la prod
  contient les évolutions du 31/08-01/09 (et le correctif pending_admin du
  28/08 qui attendait ce déploiement). Restent Z4 (pint/phpunit + test digest)
  et Z7 (recette front connectée, déploiement non requis).
- 2026-09-01 : **SES point 1 ✅ — SDK AWS installé** — `composer require
  aws/aws-sdk-php` exécuté dans le conteneur `php-fpm-8.5` via
  `composer --working-dir=/var/www/html/api-next.livrezone.com` (v3.394.6,
  contrainte `^3.394`) : post-autoload-dump + `package:discover` OK (11
  packages), `artisan --version` OK (Laravel 13.24.0), `vendor/aws/` présent
  (aws-sdk-php + aws-crt-php). composer.json + composer.lock modifiés puis
  commités. Constat au passage : le `.env` prod est en `MAIL_MAILER=smtp`
  avec `AWS_ACCESS_KEY_ID` vide (région `us-east-1`) → étape 2 (variables).
- 2026-09-02 : **SES points 2+5 ✅ / 3+6 ⏳** — `.env` prod basculé sur le
  relais SMTP SES `email-smtp.eu-west-3.amazonaws.com:587/TLS` (identifiants
  SMTP SES du propriétaire, IAM `ses-smtp-user.20260902-004919` ; le mailer
  SDK `ses` exigerait une clé IAM brute — variante documentée en roadmap),
  `MAIL_FROM_ADDRESS=no-reply@livrezone.com`, région corrigée en `eu-west-3`,
- 2026-09-02 (matin, suite SES) : **test forgot-password réel → preuve sandbox
  ⛔** — état serveur revérifié : `.env` toujours sur le relais SMTP SES
  eu-west-3 (creds présents, non affichés), `.aws.txt` absent confirmé,
  rollback `.env.bak-20260902-ses` présent, `app:queue-health` vert au départ.
  DNS depuis le conteneur : TXT apex = seul code Brevo, **SPF absent**,
  `_amazonses` TXT absent mais identité domaine **vérifiée côté SES**
  (cohérent avec le flux DKIM-only, CNAME publiés par le propriétaire dans
  Cloudflare) → propagation à vérifier dès réception des noms d'hôte CNAME.
  Test réel autorisé par le propriétaire sur le compte #12
  `peecota@hotmail.com` : d'abord `Password::sendResetLink` en tinker →
  **échec attendu** (`Route [password.reset] not defined` — le projet utilise
  un flow custom, ne pas réutiliser), puis **`POST /api/auth/forgot-password`**
  (flow réel : `AuthController@forgotPassword` + `ResetPasswordMail` en
  queue) → API répond OK, worker traite le job, SES rejette
  **`554 Message rejected: Email address is not verified …
  peecota@hotmail.com`** → **SES toujours en SANDBOX** (adresse externe non
  vérifiée refusée) ; job échoué #18 conservé dans `failed_jobs`
  (`queue:retry 18` après la sortie du sandbox). Reste propriétaire :
  « Request production access » + 3 noms d'hôte CNAME DKIM + confirmation
  réception « Test SES LivreZone #2 ».
- 2026-09-01 : **Z4 ✅ (agent, accès rootless)** — dans le conteneur
  sauvegarde `.env.bak-20260902-ses` ; `config:clear` OK ; smoke test
  `Mail::raw` → `contact@livrezone.com` : **554 Email address is not
  verified** (aucune identité vérifiée en eu-west-3 → le propriétaire lance
  la vérification du domaine `livrezone.com`, qui fournira aussi les CNAME
  DKIM) ; `app:queue-health` ✅ vert (0/0/0/0). ⚠️ Sécurité : `.aws.txt` à la
  racine du bind mount — vérifié jamais commité ; à supprimer + rotation des
  identifiants SMTP recommandée après validation de l'envoi.
- 2026-09-02 : **FIN DE SESSION (bascule SES ~90 %)** — serveur configuré et
  envoi réel accepté par SES ; restent pour demain : confirmation de réception
  dans la boîte, DKIM/SPF (CNAME pas encore posés), test forgot-password sur
  un compte réel, sortie du sandbox à confirmer, rotation des identifiants
  SMTP, surveillance bounces 24-48 h. **Prompt de reprise :
  `.agents/PROMPT-SESSION-SES.txt`.** Commits du jour : 601e003 (SDK),
  62b096e (.env.example), cadf6ad + 4d6fc5e (docs).
- 2026-09-01 : **Z4 ✅ (agent, accès rootless)** — dans le conteneur
  (`php-fpm-8.5`) : pint `--test` → 15 écarts de style (dont les fichiers V2
  NotificationContentService, NotificationPreferenceService, NotificationChannels,
  ChatDigestNotification, BookOrderedNotification, ProcessBookOrderNotifications,
  ProfileController, SendChatDigests…) → `pint` correctif appliqué, re-test
  **PASS 209 fichiers** ; phpunit **OK 84 tests / 257 assertions** (exécuté après
  correctifs) ; `notifications:send-chat-digest` lancé 2× en prod →
  « Aucun destinataire éligible (fenêtre 6 h) » les 2 fois : cas vide propre,
  pas de crash, pas de doublon. ⚠️ Quirk rootless documenté : `cd`/`-w` sans effet
  sur le cwd PHP (toujours `/var/www/html`) → utiliser des chemins absolus et
  passer les répertoires cibles à pint. Reste Z7 (recette front connectée).

