# Rapprochement bancaire (P1) — résultats

> Objectif : rapprocher les opérations bancaires avec les factures `DÉPENSES`.
> Le dashboard affichait **6 % de rapprochement / 682 txn non liées**.

## 🔴 Cause racine : l'import bancaire était cassé
Le relevé importé dans la feuille « SUIVI DES DÉPENSES » était corrompu par le
script `importerReleve()` :
- montant de l'opération **collé en fin de la colonne date** (`…(UTC+00:00) -926`) ;
- **date d'opération inexploitable** (toutes à `23/02/2026`, ou dates fantômes `1900`) ;
- colonnes « montant » contenant en réalité le **solde cumulé**.

➡️ Aucun rapprochement fiable n'était possible sur ces données. Ce n'était **pas**
un problème d'algorithme.

> ⚠️ Au passage : ce compte « EUROCOMPTE PRO » est en réalité au **Crédit Mutuel**
> (BIC `CMCIFR2A`, IBAN `FR76 10278…`), et **non BNP Paribas** comme l'indique le Sheet.

## ✅ Reconstruction propre depuis les PDF source
Les relevés PDF (`MON DRIVE/MAKI ONE/.../BANQUE/EXTRAIT COMPTES`, 10 mois
juil. 2025 → avr. 2026) ont été reparsés par `parse_releve_cm.py` :
- extraction du texte **avec coordonnées** → le signe Débit/Crédit vient de la
  **colonne** du montant (pas d'heuristique fragile) ;
- **validation automatique** : la somme Débit/Crédit reconstruite est comparée au
  total imprimé « Total des mouvements » de chaque relevé.

| Relevé | Débit | Crédit | Contrôle |
|--------|------:|-------:|:--------:|
| 2025-07 → 2026-04 (10 relevés) | — | — | **10/10 ✅ au centime** |

➡️ **3 484 opérations propres et validées** → `releve_bancaire_clean.csv`.
C'est le jeu de données qui remplace l'import cassé.

## ✅ Rapprochement factures ↔ banque
161 factures `DÉPENSES`, dont **43 bulletins de paie** (→ virements salaire) et
**21 factures de mai** (hors période, dernier relevé = 30/04).

Sur les **97 factures fournisseurs payables et couvertes** (≤ 30/04) :

| Méthode | Factures |
|---------|---------:|
| via n° de facture dans le libellé du prélèvement | 19 |
| via montant = TTC + nom fournisseur | 13 |
| via regroupement (subset-sum d'un prélèvement groupé) | 16 |
| **Total rapprochées** | **48 / 97 (49 %)** |
| Non trouvées | 49 |

Parmi les 49 non trouvées, **23 sont datées ≥ 13/04** → payées en mai (relevé pas
encore disponible). **Reste 26 réellement inexpliquées** → soit ~**65 % des factures
réellement couvrables** rapprochées (vs 6 % au départ).

➡️ Détail par facture → `rapprochement_factures.csv`.

### Pourquoi le matching n'est pas à 100 %
- **Prélèvements groupés** : J'OCÉANE, TERREAZUR, FOODEX, PAK regroupent plusieurs
  factures en un seul débit (géré par subset-sum, mais imparfait quand les factures
  s'étalent sur plusieurs prélèvements).
- **Schéma de n° différent** : TERREAZUR (« TA Provence Languedoc » dans DÉPENSES)
  référence ses factures `8481xxxxxx`, la banque `/INV/6848135xxx` → pas de clé commune.
- **Effet calendaire** : factures de fin avril / mai payées après le 30/04.

## Fichiers
| Fichier | Contenu |
|---------|---------|
| `parse_releve_cm.py` | Parseur PDF → ledger (sans dépendance, auto-validé) |
| `releve_bancaire_clean.csv` | 3 484 opérations propres (10 relevés) |
| `rapprochement_factures.csv` | 161 factures avec statut de rapprochement |

## Étapes suivantes proposées
1. **Réimporter** `releve_bancaire_clean.csv` dans le Sheet (remplace l'onglet cassé),
   et corriger `importerReleve()` pour appliquer la même logique colonne→signe.
2. **Compléter DÉPENSES** : les débits fournisseurs récurrents sans facture (assurances
   GENERALI / Mutuelle des Motards, abonnements APITIC, EDENRED…) sont des factures
   manquantes à saisir.
3. **TERREAZUR** : aligner le n° de facture saisi sur la référence `/INV/` bancaire pour
   permettre le rapprochement automatique.
