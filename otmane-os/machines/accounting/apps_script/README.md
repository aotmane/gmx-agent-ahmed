# Ingestion Factures — natif Apps Script (remplace Make)

> **P6 de l'audit** — sortir de Make pour tenir l'objectif « Claude Max only ».
> `IngestFactures.gs` remplace le scénario Make + le « Webhook Factures v3 ».
> **Rien n'est déployé tant qu'Ahmed n'a pas validé.**

## Ce que ça fait
```
Déclencheur HORAIRE (Apps Script, gratuit)
   └─ ingestFactures()
        • requête Gmail OPTIMISÉE (extensions + mots-clés + expéditeurs fournisseurs connus)
        • dépose chaque PJ dans  /MAKI ONE/<exercice>/<NN - Mois AAAA>/
        • renomme : « FOURNISSEUR - DD-MM-YYYY - Facture n° XXXXX.ext »
        • empile la facture dans l'onglet INBOX_FACTURES (statut À_TRAITER)
        • pose le label « MAKI-traite » pour ne pas retraiter
```

### Rangement Drive — exercice décalé (juillet → juin)
Ton exercice court de **juillet à juin** (confirmé par le Sheet : suivi mensuel *Jui-25 → Jui-26*).
Le script range donc sous :
```
/MAKI ONE/
   2025 - 2026/
      01 - Juillet 2025/
      02 - Août 2025/
      …
      07 - Janvier 2026/
      …
      12 - Juin 2026/
   2026 - 2027/
      01 - Juillet 2026/   …
```
- `EXERCICE_START_MONTH = 7` → l'étiquette d'exercice « AAAA - AAAA+1 » réutilise tes dossiers
  existants (« 2025 - 2026 »).
- Préfixe ordinal `01…12` = tri chronologique correct **dans** l'exercice.
- Les dossiers exercice/mois manquants sont **créés automatiquement**.

### Requête Gmail optimisée (`buildQuery_`)
```
has:attachment filename:(pdf OR jpg OR …) newer_than:30d -label:MAKI-traite
  ( facture OR invoice OR avoir OR "bon de commande" OR bulletin OR paie OR commission
    OR from:(pomona.fr OR eatsushi.fr OR …) )
```
- Combine **pièce jointe + extension + mots-clés + expéditeurs fournisseurs** (champ `from` du
  référentiel `SUPPLIERS`) → attrape les factures même sans mot-clé dans le sujet.
- Label `MAKI-traite` **sans accent** = recherche Gmail fiable.

Puis **Claude (Max)** lit `INBOX_FACTURES`, ouvre le PDF, complète fournisseur / n° /
montant HT-TVA-TTC / catégorie, et écrit la ligne propre dans `DÉPENSES`
(via le Web App « Extraction Factures » existant). Seul **Make disparaît**.

## Ce que ça corrige (vs l'ancien v3)
- **C3 / P8** — plus de mapping de mois en dur : le dossier `<exercice>/<NN - Mois AAAA>` est créé
  dynamiquement depuis la date du message (exercice décalé géré). Fini le bug « mai/juin → avril ».
- **C5** — fuseau `Europe/Paris` (l'ancien script était en `Africa/Casablanca`).
- **C1 / P6** — aucune dépendance externe : Make n'est plus dans la boucle.
- **C2 / P7** — plus de Web App publique `ANYONE_ANONYMOUS` ni de secret en dur pour CE flux
  (déclenchement interne par trigger). *(L'extraction reste un Web App à sécuriser séparément.)*

## Installation (quand tu valides)
1. Crée un projet Apps Script (ou réutilise « MAKI ONE — Extraction Factures ») et colle
   `IngestFactures.gs`.
2. Vérifie `CONFIG` :
   - `MAKI_ONE_FOLDER_ID` — dossier `/MAKI ONE/` (pré-rempli).
   - `EXERCICE_START_MONTH` — **7 (juillet)** par défaut ; change si ton exercice démarre un autre mois.
   - `QUEUE_SHEET_ID` — ton Sheet « SUIVI DES DÉPENSES ».
   - `SUPPLIERS` — complète tes fournisseurs récurrents (et leur `from:` domaine pour la requête).
   - `LOOKBACK_DAYS` — fenêtre de recherche (30 j par défaut).
3. Lance **`dryRun()`** : log sans rien déposer, pour vérifier que la requête Gmail attrape les
   bons emails et que les fournisseurs sont bien devinés.
4. Lance **`ingestFactures()`** une fois à la main et contrôle Drive + l'onglet `INBOX_FACTURES`.
5. Lance **`installTrigger()`** pour activer le passage horaire automatique.

## Migration depuis Make (ordre conseillé)
1. Déployer + tester ce script **en parallèle** de Make (label séparé, dossier de test si besoin).
2. Vérifier 2-3 jours que tout arrive correctement.
3. **Désactiver le scénario Make**, puis **retirer l'accès public** de l'ancien « Webhook v3 »
   (et faire tourner le secret).
4. Archiver le script « Gmail PDF → Drive FACTURES » (doublon, C4).

## Limites assumées (déterministe)
- `guessFournisseur_` / `guessNumFacture_` sont du **best effort** (expéditeur + sujet). Les cas
  `À-IDENTIFIER` / `À-COMPLÉTER` sont volontairement laissés à **Claude** qui lit le contenu du
  PDF — c'est là que vit l'intelligence, gratuitement via ton abonnement.
