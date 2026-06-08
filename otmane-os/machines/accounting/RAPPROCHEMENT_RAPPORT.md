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

## ✅ Reconstruction propre depuis les PDF source (2 banques harmonisées)
MAKI ONE a **deux banques** : le **Crédit Mutuel** (C/C EUROCOMPTE PRO) et la **BNP
Paribas** (compte courant du prêt + abonnements). Un parseur unique `parse_releve.py`
reconstruit les deux dans **un schéma commun** :
- extraction du texte **avec coordonnées** → le signe Débit/Crédit vient de la
  **colonne** du montant (x < 480 → Débit), identique pour les deux banques ;
- **détection auto** de la banque (BIC) et adaptation du format : date CM `JJ/MM/AAAA`
  vs BNP `JJ.MM.AA`, séparateur de milliers CM « . » vs BNP « espace » ;
- **validation automatique** : chaque relevé est comparé à son total imprimé
  (« Total des mouvements » pour CM, « TOTAL DES OPERATIONS » pour BNP).

| Banque / compte | Relevés | Contrôle |
|-----------------|--------:|:--------:|
| Crédit Mutuel `…0150155` | 10 (juil. 25 → avr. 26) | **10/10 ✅ au centime** |
| BNP Paribas `…0166420` | 6 | **6/6 ✅ au centime** |
| BNP Paribas `…0173016` (2ᵉ compte, ouvert févr. 26) | 1 | **1/1 ✅ au centime** |

➡️ **3 544 opérations propres et validées** → `ledger_unifie.csv`
(colonnes `Date ; Banque ; Compte ; Sens ; Montant ; Libelle ; Detail`).
C'est le jeu de données qui remplace l'import cassé, pour les deux banques.

> Note : le compte BNP est à faible activité (~6-7 op./mois) — essentiellement les
> échéances du **prêt BNP** (1 056,43 € + 31,37 €), les virements Swile/Uber/Edenred,
> les frais BNP, et le virement mensuel CM→BNP de 1 100 € qui alimente le prêt.

## ✅ Rapprochement factures ↔ banque
161 factures `DÉPENSES`, dont **43 bulletins de paie** (→ virements salaire) et
**21 factures de mai** (hors période, dernier relevé = 30/04).

Sur les **97 factures fournisseurs payables et couvertes** (≤ 30/04) :

| Méthode | Factures |
|---------|---------:|
| via n° de facture dans le libellé du prélèvement | 19 |
| via montant = TTC + nom fournisseur | 13 |
| via regroupement (subset-sum daté d'un prélèvement groupé) | 18 |
| **Total rapprochées** | **50 / 97 (52 %)** |
| Non trouvées | 47 |

Parmi les 47 non trouvées, **24 sont datées ≥ 13/04** → payées en mai (relevé pas
encore disponible). **Reste 23 réellement inexpliquées** → soit ~**68 % des factures
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
| `parse_releve.py` | Parseur unifié CM + BNP → ledger (sans dépendance, auto-validé) |
| `ledger_unifie.csv` | 3 544 opérations propres des 2 banques (17 relevés) |
| `rapprochement.py` | Matcher factures ↔ banque (n° / montant / regroupement daté) |
| `rapprochement_factures.csv` | 161 factures avec statut de rapprochement |

## Étapes suivantes proposées
1. **Réimporter** `ledger_unifie.csv` dans le Sheet (remplace l'onglet cassé), et
   corriger `importerReleve()` pour appliquer la même logique colonne→signe (CM **et** BNP).
2. **Compléter DÉPENSES** : les débits fournisseurs récurrents sans facture (assurances
   GENERALI / Mutuelle des Motards, abonnements APITIC, EDENRED…) sont des factures
   manquantes à saisir.
3. **TERREAZUR** : aligner le n° de facture saisi sur la référence `/INV/` bancaire pour
   permettre le rapprochement automatique.
