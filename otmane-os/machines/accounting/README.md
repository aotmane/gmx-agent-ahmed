# Machine 2 — Expert-comptable

**Tâche :** récupérer les factures, classer les dépenses, préparer la TVA, et transmettre un
dossier mensuel propre à l'expert-comptable.

**Statut :** spec

## Flux
```
Emails + Drive (factures PDF)  →  extraction (OCR)  →  catégorisation des dépenses
        →  calcul TVA  →  dossier mensuel  →  envoi à l'expert-comptable (email)
```

## Étapes
1. **Collecte** — la machine Email & Admin repère les emails `facture` ; les PDF sont déposés
   dans un dossier Drive `Compta/<année>/<mois>/`.
2. **Extraction** — OCR + parsing : fournisseur, date, montant HT, TVA, TTC.
3. **Catégorisation** — règles par fournisseur/mot-clé (achats, abonnements, frais…).
4. **TVA** — agrégation par taux (`VAT_RATE`), préparation déclaration.
5. **Livraison** — dossier mensuel + récap (Google Sheet) envoyé automatiquement au comptable.

## Outils MCP
Gmail (collecte/envoi) · Google Drive (rangement) · n8n (orchestration + data table) ·
Calendar (échéances fiscales).

## À définir avec toi
- Taux de TVA applicables, plan de catégories, périodicité (mensuelle/trimestrielle),
  email de l'expert-comptable, format attendu (FEC ? Excel ? PDF ?).
