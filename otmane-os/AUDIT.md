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

## 1bis. Détail des 3 Apps Scripts

| Script | Type | Rôle réel | Points notables |
|--------|------|-----------|-----------------|
| **Extraction Factures** | Web App `doGet`/`doPost` (847 l.) | Écrit les factures dans l'onglet `DÉPENSES`, reconstruit `DASHBOARD`, normalise catégories, dédoublonne, nettoie les bulletins de paie | Claude pousse les données extraites ici |
| **Gmail PDF → Drive FACTURES** | Web App `doPost` | Reçoit un `messageId`, récupère la PJ Gmail, la dépose dans **un** dossier FACTURES (dédoublonnage par nom) | Probablement remplacé par le v3 |
| **Webhook Factures MAKI ONE v3** | Web App `doPost` | Reçoit des métadonnées **de Make** (fournisseur, date, mois, n°), classe la PJ dans le **dossier du mois**, renomme `FOURNISSEUR - DD-MM-YYYY - Facture n° XXXXX` | Mapping `DOSSIERS_MOIS` (12 dossiers/an) |

### Constats techniques (bloquants pour « Claude Max only »)
- **C1 — Dépendance Make (payant).** Le v3 est déclenché par Make. Pour rester sur Claude Max,
  remplacer Make par un **déclencheur Apps Script natif** (trigger horaire qui scanne Gmail par
  label/recherche) — gratuit, hébergé par Google.
- **C2 — Sécurité.** Secret de webhook **en dur** dans 2 scripts (non reproduit ici) + déploiement
  Web App en **`ANYONE_ANONYMOUS`** (endpoints publics protégés par ce seul secret). À faire tourner
  + restreindre l'accès.
- **C3 — Bug mapping mois.** Dans `DOSSIERS_MOIS`, **mai (5) et juin (6) pointent vers le dossier
  AVRIL temporaire** → factures classées au mauvais endroit. À corriger (créer les dossiers mai/juin).
  → **Arborescence réelle** (Mon Drive) : `MAKI ONE/2025 - 2026/FACTURES/` (boîte à traiter) puis
  `FACTURES/TRAITEES/<AAAA-MM - mois AAAA>/` (classé). C'est cette convention que les nouveaux
  scripts respectent (mois calculé sur la **date de facture**).
- **C4 — Redondance.** 3 Web Apps avec une logique « PJ Gmail → Drive » qui se chevauche
  (`Gmail PDF → Drive` vs `Webhook v3`). À consolider en **un seul** point d'entrée.
- **C5 — Fuseau horaire** des scripts = `Africa/Casablanca` alors que l'activité est en France
  (`Europe/Paris`) → décalage possible sur les dates. À aligner.

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
| P6 | **Dépendance Make** (payant) pour déclencher l'ingestion factures | Remplacer par trigger Apps Script natif (gratuit) |
| P7 | **Endpoints Web App publics + secret en dur** | Faire tourner le secret + restreindre l'accès |
| P8 | **Mai/juin classés dans le dossier AVRIL** (bug mapping) | Créer les dossiers mensuels + corriger le mapping |

## 4. Cible « Claude Max only »

- **Cerveau :** Claude (abonnement Max) — extraction, contrôle, rapprochement, reporting.
- **Machines :** Google Apps Script (gratuit) + Google Sheets/Drive/Gmail/Calendar.
- **Pont :** la Web App Apps Script existante (`doGet/doPost`) reste le point d'entrée ;
  Claude l'appelle pour lire/écrire les Sheets. **Pas de n8n/Make payant.**
- **Second Brain = les 2 Sheets existants** (Pilotage + Suivi des dépenses), enrichis des
  référentiels manquants (Fournisseurs, Menu/food cost, Marketing local).

## 5. Prochaines étapes proposées (par priorité d'impact)
**Hygiène / socle (rapide, débloque le reste) :**
- **P6 — Supprimer Make** : remplacer le déclencheur du v3 par un trigger horaire Apps Script qui
  scanne Gmail (label/recherche). Indispensable pour « Claude Max only ».
- **P8 — Corriger le mapping mois** (mai/juin → AVRIL) + créer les dossiers manquants.
- **P7 — Sécuriser** : faire tourner le secret webhook, consolider en un seul Web App.

**Valeur métier (par impact) :**
1. **P2 — Contrôle de conformité des 107 factures** (gain rapide, données déjà là).
2. **P1 — Rapprochement bancaire** des 682 txn (le plus gros volume).
3. **P4 — Pilotage CA quotidien** + alertes food/labor/prime cost.
4. **P3 — Suivi des paiements & trésorerie** (relances fournisseurs).

> Audit de l'existant : **terminé** (3 Apps Scripts + 2 Sheets + dossiers cartographiés).
