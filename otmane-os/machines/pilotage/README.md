# Machine — Cockpit de pilotage (Web App)

> Interface de pilotage **gratuite** (Apps Script Web App), mobile, qui **lit ET écrit**.
> Choix validé : *Web App cockpit + saisie*. Comble le **CA quotidien vide** (P4 de l'audit).

## Ce que ça fait
```
┌─ ✏️ Saisie du jour ─────────────┐     ┌─ 📊 Cockpit du mois ──────────────┐
│ CA (sur place / emporter /      │     │ CA HT · couverts · panier moyen   │
│ livraison / agrégateurs)        │     │ Food cost %   (vs objectif)       │
│ couverts · tickets · offerts    │ ──▶ │ Labor cost %  (vs objectif)       │
│ heures planifiées / pointées    │     │ Prime cost %  (vs objectif)       │
│ → CA total + panier auto        │     │ Heures (écart) · 7 derniers jours │
└─────────────────────────────────┘     └───────────────────────────────────┘
```
- **Saisie** → onglet `SAISIE_JOURNALIERE` du Sheet *Pilotage Eat Sushi Manosque*
  (créé automatiquement au 1er lancement). Upsert : ré-éditer un jour le met à jour.
- **Cockpit** → calcule le **food/labor cost** en sommant les achats du mois par catégorie
  dans `DÉPENSES` (SUIVI DES DÉPENSES) : `food = Matières premières + Boissons`, `labor = Salaires`.
- **Alertes couleur** (vert / orange / rouge) selon les objectifs `TARGET_*`.

## Saisie du CA AUTOMATISÉE (export caisse → table CA_CAISSE)
La saisie du CA n'est pas que manuelle : elle est **alimentée par tes exports de caisse**.
```
Export caisse (CSV/Excel) ─dépôt→ /MAKI ONE/<exercice>/CAISSE/
        └─[IngestCaisse.gs, horaire] parse la feuille de caisse → table CA_CAISSE (mensuelle)
              └─ déplace le fichier → CAISSE/TRAITEES/
        Cockpit : CA du mois lu en priorité depuis CA_CAISSE
```
- **Format réel géré** : « Feuille de caisse » clé/valeur, séparée par `;`, décimales à virgule
  (ex. `ESM - feuille_de_caisse_Septembre_2025.csv`). Période en en-tête (`sept-25` → `2025-09`).
- **Extrait** : `CA HT`, `CA TTC`, ventilation par moyen de paiement (CB, espèces, en ligne,
  ticket resto) et **agrégateurs** (UBER EATS / Deliveroo / Just Eat), commandes retirées.
- **Granularité = mensuelle** (l'export est mensuel) → le cockpit calcule food/labor/prime cost
  sur ce CA réel. Couverts/heures restent en saisie manuelle (absents de la feuille de caisse).
- **100 % déterministe** : pas besoin de Claude par fichier. Pour les `.xlsx`, activer le
  *Service avancé Drive* (Services ▸ Drive API) pour la conversion.

> Dossier cible **défini** : `/MAKI ONE/2025 - 2026/CAISSE/` (dépôt) + `CAISSE/TRAITEES/` (traité).

## Fichiers
- `apps_script/Code.gs` — serveur cockpit : `doGet`, `saveDaily`, `getCockpit`, `getRecentDays`.
- `apps_script/Index.html` — interface mobile (cockpit + formulaire), thème sombre MAKI.
- `apps_script/IngestCaisse.gs` — ingestion auto des feuilles de caisse → `CA_CAISSE`
  (`ingestCaisse`, `installCaisseTrigger`, `dryRunCaisse(fileId)`).
- `apps_script/ApiticConnector.gs` — API caisse Apitic → `CA_APITIC` (CA + couverts + tickets/jour).
- `apps_script/ComboConnector.gs` — API RH Combo → `RH_COMBO` (heures + masse salariale/mois).

## Connecteurs API (Apitic + Combo) — cockpit 100 % auto
Sources de données du cockpit, par **ordre de priorité** :
| Donnée | 1er choix | repli | repli 2 |
|--------|-----------|-------|---------|
| CA + couverts + tickets | **Apitic** (`CA_APITIC`, jour) | Caisse CSV (`CA_CAISSE`, mois) | Saisie manuelle |
| Heures + masse salariale | **Combo** (`RH_COMBO`, mois) | catégorie `Salaires` des DÉPENSES | — |
| Food cost | Achats `Matières premières + Boissons` des DÉPENSES | — | — |

### Mise en place (par API)
1. **Secrets** → Paramètres du projet ▸ Propriétés du script (jamais en dur / git) :
   - **Combo** : `COMBO_TOKEN` + `COMBO_LOCATION_ID` (lance `comboListLocations()` pour le trouver).
   - **Apitic** : `APITIC_EMAIL` + `APITIC_PASSWORD` + `APITIC_ACCOUNT_ID`
     (lance `apiticListAccounts()` pour le trouver).
2. **Calibrage** :
   - Combo : `comboDryRun()` affiche 3 shifts → vérifier les champs ; ajuster `CHARGE_MULTIPLIER`
     (coeff. charges patronales, ex. 1.42) et `BREAK_UNIT_MINUTES` si besoin.
   - Apitic : `apiticAuthTest_()` valide le login + montre le champ du token, puis (EP_SALES connu)
     `apiticDryRun()` pour caler les `F_*`.
3. **Activer** → `installComboTrigger()` / `installApiticTrigger()` (pull quotidien).

**Combo — confirmé (Swagger)** : `GET /api/v1/plannings?start_date=&end_date=&location_id=` renvoie
le **prévu** (`starts_at/ends_at/break_duration`) **et le réalisé** (`real_*`) par shift ; le taux
horaire vient de `GET /api/v1/contracts` (`hourly_gross_rate`) ; `GET /api/v1/locations` liste les
`location_id`. → heures planifiées/pointées calculées depuis les horodatages, masse salariale =
heures × taux × charges. Reste à confirmer : le **schéma d'auth exact** (bouton « Autoriser » du
Swagger) et l'unité de `break_duration`.

**Apitic — confirmé (Swagger)** : `POST /token {email,password}` → `{access_token}` (Bearer) ;
`GET /accounts` → `APITIC_ACCOUNT_ID` ; `GET /accounts/{id}/sales/{date}` = **une entrée par
ticket** (`guests_number`, `sale_type`, `platform`, `lines[].excl_tax_price`/`ati_price`). Le
connecteur agrège par jour : CA HT/TTC, couverts, tickets, ventilation (sur place / emporter /
livraison / agrégateurs). ⏰ **Fenêtres API interdites** (CET) : 05–06h, 11h30–14h30, 18h30–22h30,
**10 req/s** → pull planifié à **03h** (`pullApiticYesterday`). Backfill d'un mois : `pullApitic('2026-04')`.

## Déploiement
1. Nouveau projet Apps Script → 2 fichiers : `Code.gs` + `Index.html` (HTML).
2. **Déployer ▸ Application Web** · *Exécuter en tant que : moi* · *Accès : Moi uniquement*.
3. Ouvrir l'URL sur ton téléphone (ajouter à l'écran d'accueil = appli).

## Configuration (`CFG` dans Code.gs)
- `PILOTAGE_SS_ID`, `DEPENSES_SS_ID` — pré-remplis (tes 2 Sheets).
- `FOOD_CATS` / `LABOR_CAT` — catégories utilisées pour le food/labor cost.
- `TARGET_FOOD` 30 % · `TARGET_LABOR` 35 % · `TARGET_PRIME` 65 % — **objectifs à ajuster** à ta réalité.

## Notes
- Le food cost est mensuel (les factures d'achat sont périodiques) ; le CA est quotidien.
- `SAISIE_JOURNALIERE` est une table propre et autonome → n'altère pas le template Pilotage existant.
  On pourra ensuite brancher la *Synthèse mensuelle* du Pilotage dessus.
- 100 % Claude Max : aucun service payant.
