# Audit de l'existant — Eat Sushi Manosque (MAKI ONE)

> Réalisé avant de construire le Second Brain, pour **ne rien dupliquer** et tout faire tourner
> **uniquement sur l'abonnement Claude Max + Google Workspace** (zéro service payant).

## 1. Ce qui tourne DÉJÀ (et qu'on garde)

### Architecture actuelle
```
Gmail (factures PDF reçues)
   │   [Apps Script] MAKI ONE — Gmail PDF → Drive FACTURES
   ▼
Google Drive  /MAKI ONE/...  (PDF rangés)
   │   [Apps Script] MAKI ONE — Extraction Factures  (Code.gs, 847 lignes)
   │      • Web App : doGet(e) / doPost(e)  ← Claude pousse les données extraites
   │      • normalise les catégories (normCat_), dédoublonne, nettoie les bulletins de paie
   │      • écrit dans l'onglet DÉPENSES, puis reconstruit le DASHBOARD (rebuildAfterWrite_)
   │   [Apps Script] Webhook Factures MAKI ONE
   ▼
Google Sheets
   • « ESM — SUIVI DES DÉPENSES »  (1vzCam67Bf4p5NsFX2XDom3GOD2LB8ziDaHlvqcrCph0)
       onglets : DÉPENSES (saisie) + DASHBOARD (synthèse auto)
   • « Pilotage Eat Sushi Manosque » (16LNpH29uvMFQQDE3WFBEgK_oyqi1YvoM2G6DsAh_Y7A)
       CA quotidien · Factures fournisseurs · Heures salariés · Synthèse mensuelle
```
> **Claude est déjà le cerveau d'extraction** (commentaire du code : « Notifier Claude qui
> re-push les 43 bulletins »). L'OS ne fait que formaliser et étendre ce qui existe.

### Assets (IDs Drive)
| Asset | Type | ID |
|-------|------|----|
| Dossier racine MAKI ONE | folder | `1QuKDG5_kjR7eMxhXGBclgy6fPJWQj8gq` |
| ESM — SUIVI DES DÉPENSES | Sheet | `1vzCam67Bf4p5NsFX2XDom3GOD2LB8ziDaHlvqcrCph0` |
| Pilotage Eat Sushi Manosque | Sheet | `16LNpH29uvMFQQDE3WFBEgK_oyqi1YvoM2G6DsAh_Y7A` |
| Pilotage — Agent Controller | folder | `12lwmK8DTynDvUFyl320n-SR_6b3_Fni0` |
| Extraction Factures | Apps Script | `1nKYlpXBRyBaGntDmh0-WPzBP35fzKnJJ…` |
| Gmail PDF → Drive FACTURES | Apps Script | `16-20VWSJU9kba7cF_sZSz2jywI33qFQg5…` |
| Webhook Factures MAKI ONE | Apps Script | `1FyumzwQlDNFKR5-ahTADMUK2o9lK7MdL…` |

## 2. Modèle de données réel

**SUIVI DES DÉPENSES** — catégories utilisées (= référentiel Familles de la compta) :
Matières premières · Boissons · Emballages · Loyer & Charges · Equipements · Entretien ·
Marketing · Honoraires · Transport · IT et Logiciels · Livraison · Salaires · Divers.

Blocs du DASHBOARD : synthèse (HT/TTC/payé/en attente/nb), mensuel + variation %,
conformité (conforme / à vérifier), ventilation par catégorie, **rapprochement bancaire**
(N° Facture ↔ ligne banque, écart €, Δ jours).

## 3. Points de douleur identifiés (= là où l'OS apporte de la valeur)

| # | Constat (au 06/2026) | Opportunité |
|---|----------------------|-------------|
| P1 | **Rapprochement bancaire à 6 %** — 682 transactions non liées | Machine de rapprochement auto facture ↔ banque |
| P2 | **Conformité 0 %** — 107 factures « à vérifier » | Contrôle de cohérence (HT+TVA=TTC, doublons, fournisseur connu) |
| P3 | **MONTANT PAYÉ = 0 €**, EN ATTENTE = 129 231 € | Statut de paiement non suivi → relances / trésorerie |
| P4 | Pilotage CA quotidien **non rempli** (#ERROR sur formules) | Saisie/import du CA journalier + alertes food/labor/prime cost |
| P5 | Catégorie **Salaires = 56 %** du TTC mélangée aux achats | Séparer paie / achats fournisseurs pour un vrai food cost |

## 4. Cible « Claude Max only »

- **Cerveau :** Claude (abonnement Max) — extraction, contrôle, rapprochement, reporting.
- **Machines :** Google Apps Script (gratuit) + Google Sheets/Drive/Gmail/Calendar.
- **Pont :** la Web App Apps Script existante (`doGet/doPost`) reste le point d'entrée ;
  Claude l'appelle pour lire/écrire les Sheets. **Pas de n8n/Make payant.**
- **Second Brain = les 2 Sheets existants** (Pilotage + Suivi des dépenses), enrichis des
  référentiels manquants (Fournisseurs, Menu/food cost, Marketing local).

## 5. Prochaines étapes proposées (par priorité d'impact)
1. **P2 — Contrôle de conformité des 107 factures** (gain rapide, données déjà là).
2. **P1 — Rapprochement bancaire** des 682 txn (le plus gros volume).
3. **P4 — Pilotage CA quotidien** + alertes food/labor/prime cost.
4. **P3 — Suivi des paiements & trésorerie** (relances fournisseurs).

> Reste à auditer en profondeur : les 2 autres Apps Scripts (Gmail→Drive, Webhook) et le
> dossier « Agent Controller » — à faire avant de toucher au pipeline d'extraction.
