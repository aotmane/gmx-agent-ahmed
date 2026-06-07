# Ingestion Factures — natif Apps Script (remplace Make)

> **P6 de l'audit** — sortir de Make pour tenir l'objectif « Claude Max only ».
> `IngestFactures.gs` remplace le scénario Make + le « Webhook Factures v3 ».
> **Rien n'est déployé tant qu'Ahmed n'a pas validé.**

## Ce que ça fait
```
Déclencheur HORAIRE (Apps Script, gratuit)
   └─ ingestFactures()
        • cherche dans Gmail les factures non traitées (CONFIG.GMAIL_QUERY)
        • dépose chaque PJ valide dans Drive /racine/AAAA-MM/   ← dossier mensuel auto
        • renomme : « FOURNISSEUR - DD-MM-YYYY - Facture n° XXXXX.ext »
        • empile la facture dans l'onglet INBOX_FACTURES (statut À_TRAITER)
        • pose le label « MAKI-traité » pour ne pas retraiter
```
Puis **Claude (Max)** lit `INBOX_FACTURES`, ouvre le PDF, complète fournisseur / n° /
montant HT-TVA-TTC / catégorie, et écrit la ligne propre dans `DÉPENSES`
(via le Web App « Extraction Factures » existant). → la répartition des rôles reste la même,
seul **Make disparaît**.

## Ce que ça corrige (vs l'ancien v3)
- **C3 / P8** — plus de mapping de mois en dur : le dossier `AAAA-MM` est créé dynamiquement
  depuis la date du message. Fini le bug « mai/juin rangés dans avril ».
- **C5** — fuseau `Europe/Paris` (l'ancien script était en `Africa/Casablanca`).
- **C1 / P6** — aucune dépendance externe : Make n'est plus dans la boucle.
- **C2 / P7** — plus de Web App publique `ANYONE_ANONYMOUS` ni de secret en dur pour CE flux
  (déclenchement interne par trigger). *(L'extraction reste un Web App à sécuriser séparément.)*

## Installation (quand tu valides)
1. Crée un projet Apps Script (ou réutilise « MAKI ONE — Extraction Factures ») et colle
   `IngestFactures.gs`.
2. Vérifie `CONFIG` :
   - `ROOT_FOLDER_ID` — dossier racine des factures (pré-rempli depuis le v3).
   - `QUEUE_SHEET_ID` — ton Sheet « SUIVI DES DÉPENSES ».
   - `GMAIL_QUERY` — **idéalement, crée un label Gmail dédié** (ex. `Factures`) et filtre dessus.
   - `SUPPLIERS` — complète tes fournisseurs récurrents.
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
