# Machine 2 — Expert-comptable

**Tâche :** récupérer les factures, classer les dépenses, préparer la TVA, et transmettre un
dossier mensuel propre à l'expert-comptable.

**Statut :** 🔧 en cours — pipeline d'ingestion + étape Claude livrés (à déployer/valider)

## Flux (réel, Claude Max only)
```
Gmail ─[apps_script/IngestFactures.gs, horaire]→ Drive /MAKI ONE/<exercice>/<mois>/
                                                 └→ file INBOX_FACTURES (À_TRAITER)
        ÉTAPE CLAUDE (CLAUDE_STEP.md) : lit le PDF → extrait → WriteDepense
                                                 └→ DÉPENSES → DASHBOARD
        Livraison : dossier mensuel + récap → expert-comptable (à brancher)
```

## Composants livrés
- **`apps_script/IngestFactures.gs`** — déclencheur natif (remplace Make), rangement par
  exercice décalé, file `INBOX_FACTURES`. → voir `apps_script/README.md`.
- **`apps_script/WriteDepense.gs`** — endpoint sécurisé d'écriture dans `DÉPENSES` (secret en
  Script Property, dédoublonnage `c0`, marque la file).
- **`CLAUDE_STEP.md`** — playbook d'extraction : schéma 15 colonnes, règles de conformité
  (HT+TVA=TTC, TVA mixte, bon destinataire, autoliquidation UE), exemple validé.

## Reste à faire
1. Déployer + valider IngestFactures (dryRun) et WriteDepense (secret).
2. Brancher l'exécution de l'étape Claude en routine.
3. **Livraison mensuelle** au comptable (dossier + récap Sheet → email).
4. Sécuriser l'ancien Web App « Extraction Factures » (P7).

## ⚠️ Existant à réutiliser (Eat Sushi Manosque)
Un pipeline factures tourne DÉJÀ en Google Apps Script — ne pas le recréer, l'orchestrer :
- `MAKI ONE — Gmail PDF → Drive FACTURES` (collecte)
- `MAKI ONE — Extraction Factures` (extraction)
- `Webhook Factures MAKI ONE`
- Les montants alimentent l'onglet **Factures fournisseurs** du Sheet « Pilotage Eat Sushi Manosque ».

## Outils MCP
Gmail (collecte/envoi) · Google Drive (rangement) · Apps Script existant · n8n (orchestration) ·
Calendar (échéances fiscales).

## À définir avec toi
- Taux de TVA applicables, plan de catégories, périodicité (mensuelle/trimestrielle),
  email de l'expert-comptable, format attendu (FEC ? Excel ? PDF ?).
