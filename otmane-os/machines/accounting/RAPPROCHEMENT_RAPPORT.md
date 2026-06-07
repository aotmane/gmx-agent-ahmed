# Rapport de rapprochement bancaire (P1)

> Objectif : rapprocher les transactions bancaires avec les factures `DÉPENSES`.
> Le dashboard affichait **6 % de rapprochement / 682 txn non liées**. Diagnostic ci-dessous.

## 🔴 Cause racine : l'import bancaire est cassé (pas le matching)
Le tableau du relevé BNP (onglet de la feuille « SUIVI DES DÉPENSES ») est **mal structuré** par
le script d'import (`importerReleve("BNP")`) :
- le **montant** de l'opération est collé en fin de la colonne « date » (ex. `…(UTC+00:00) -926`)
  au lieu d'être dans une colonne dédiée ;
- la **date d'opération** est inexploitable (toutes à `23/02/2026`, ou des dates fantômes type
  `02/03/1900`) ;
- les colonnes « montant » contiennent en fait le **solde cumulé** (12 842 € → 14 807 €…).

→ Tant que l'import n'est pas corrigé, **aucun matching fiable par date** n'est possible. C'est la
vraie raison des 6 %, pas l'algorithme.

## ✅ Ce qui est malgré tout récupérable (signal fort)
En extrayant le montant (nombre en fin de chaîne / delta de solde) et le libellé réel :
- **44 prélèvements `PRLV SEPA`** (= paiements fournisseurs) récupérés avec **montant + nom du
  fournisseur** dans le libellé (ENGIE, METRO, J'OCÉANE, TERREAZUR, PAK, CQFD, KLESIA, DGFIP…) ;
- beaucoup de libellés contiennent les **numéros de facture** (`F26-034928,F26-038202…`).

### Potentiel de rapprochement automatique (POC sur les 44 PRLV)
| Méthode | Matchés |
|---------|---------|
| via n° de facture présent dans le libellé | 2 |
| via montant = TTC exact | 10 |
| via fournisseur identifié (montant groupé) | 16 |
| **Total auto-rapprochable** | **28 / 44 (~64 %)** |
| Non rapprochés | 16 |

Les 16 non rapprochés sont surtout des dépenses **sans facture dans DÉPENSES** (FOODEX 2 989 €,
assurances GENERALI/Mutuelle des Motards, abonnement APITIC, EDENRED, ALPES DÉTERGENTS) → ils
révèlent des **factures manquantes** à intégrer (valeur en soi).

## Plan recommandé
1. **Réparer l'import bancaire** (priorité) : reparser le relevé source (CSV/PDF BNP du dossier
   `BANQUE`) en colonnes propres `Date | Libellé | Débit | Crédit | Solde`. C'est le déblocage.
2. **Rapprocheur** `Rapprochement.gs` : pour chaque débit fournisseur, matcher dans l'ordre :
   (a) **n° de facture** trouvé dans le libellé → `DÉPENSES.Facture n` ;
   (b) **montant = TTC** (± tolérance commissions) ;
   (c) **fournisseur + montant groupé** (un prélèvement = plusieurs factures sommées) ;
   puis écrire `Date banque / Montant banque / Écart / Statut` et marquer les factures `Payé`.
3. **Factures manquantes** : lister les débits sans facture (FOODEX, assurances, abonnements…)
   pour les ajouter à `DÉPENSES`.

## Reste à confirmer pour coder le rapprocheur
- Le **nom de l'onglet** du relevé bancaire + ses colonnes réelles (le rendu Markdown ne donne pas
  les noms d'onglets), **ou** un **export CSV propre** du relevé BNP (le plus simple et fiable).
