# Rapport de conformité — DÉPENSES (P2)

> Contrôle des **161 factures** de l'onglet `DÉPENSES` (« SUIVI DES DÉPENSES »).
> Règles : cohérence `HT + TVA = TTC`, TVA mixte tolérée, catégories du référentiel, taux TVA
> plausibles, champs obligatoires. Les **bulletins de paie** (sans TVA) sont traités à part.

## Synthèse
| Statut | Nb | Détail |
|--------|----|--------|
| ✅ Conformes | ~108 | dont 40 « TVA mixte » (5,5 %+10 %) + 7 bulletins de paie (sans TVA) |
| ⚠️ À corriger | **~15** | incohérences réelles, montants manquants, taux 5,0 %, catégorie hors liste |
| 🔶 Traçabilité | 45 | n° de facture fournisseur manquant (non bloquant) |

## Anomalies à corriger (priorité)

### 1. Incohérence HT + TVA ≠ TTC (4 réelles)
Hors bulletins de paie (eux n'ont pas de TVA, normal). À re-vérifier sur le PDF :
| N° interne | Fournisseur | Date | Constat |
|-----------|-------------|------|---------|
| FAC-2026-820000796733 | ENGIE | 04/05/2026 | 368,24 + 90,42 = 458,66 ≠ 542,54 (taxes énergie ?) |
| FAC-2026-320008264350 | ENGIE | 06/04/2026 | 582,57 + 136,36 = 718,93 ≠ 818,18 |
| FAC-2026-220008934145 | ENGIE | 07/03/2026 | 552,23 + 129,00 = 681,23 ≠ 773,98 |
| FAC-2026-202681882 | PAK Emballages | 30/04/2026 | 260,28 + 59,86 = 320,14 ≠ 359,14 |

> Les factures **ENGIE** portent des taxes (CSPE/TICGN/CTA) en plus de la TVA → le HT saisi ne
> couvre pas tout. À ressaisir avec le détail, sinon le food/charges cost est faussé.

### 2. Montants HT/TVA manquants (6)
TTC présent mais HT/TVA vides → à compléter :
`EAT SUSHI` redevances 1 200 € (×3 : mars/avril/mai), `CQFD EXPERTISE` 1 569,60 €,
`J'OCEANE` relevé 1 157,23 €, `GROUPE OTMANE INVESTISSEMENT` 7 200 €.

### 3. Taux TVA à 5,0 % → probablement 5,5 % (5)
`TA Provence Languedoc (Pomona)` ×4 et `COMPTOIRS OCEANIQUES` ×1 : produits frais alimentaires =
**5,5 %** en France. Le 5,0 % est très probablement une **erreur d'extraction**.

### 4. Catégorie « Commissions paiement » hors référentiel (4)
`Too Good To Go`, `LYF SAS`, `Groupon France` ×2. Ce n'est pas une erreur de saisie mais un
**manque dans le référentiel** → **ajouter la catégorie « Commissions »** (commissions
agrégateurs / encaissement) à `normCat_` et au plan de catégories.

## Traçabilité (non bloquant)
- **45 n° de facture fournisseur manquants** (colonne `Facture n`) : à compléter au fil de l'eau
  (l'étape Claude le renseigne désormais à l'ingestion).

## Automatisation
`apps_script/CheckConformite.gs` applique ces règles et **remplit la colonne `Conformité`** de
`DÉPENSES` (`Conforme` / `À vérifier — raison`), de façon répétable. Lancer `runConformite()`.
