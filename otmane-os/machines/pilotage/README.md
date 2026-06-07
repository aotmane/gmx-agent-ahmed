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

## Fichiers
- `apps_script/Code.gs` — serveur : `doGet` (sert l'UI), `saveDaily`, `getCockpit`, `getRecentDays`.
- `apps_script/Index.html` — interface mobile (cockpit + formulaire), thème sombre MAKI.

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
