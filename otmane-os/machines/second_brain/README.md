# Machine 3 — Second Brain (Foundation)

**Tâche :** centraliser le savoir et les données de pilotage en une source de vérité unique
qui **alimente toutes les autres machines**.

**Statut :** en cours — ancré sur les assets EXISTANTS d'Eat Sushi Manosque (MAKI ONE).

## Contexte réel (important)
L'activité opérationnelle est **Eat Sushi Manosque**, exploitée par **MAKI ONE (SAS)** —
restaurant de sushis, franchise Eat Sushi. (`manosque@eatsushi.fr`). Le holding
**Groupe Otmane Investissement** détient/finance l'ensemble.

> Le Second Brain ne réinvente RIEN : il s'appuie sur ce qui tourne déjà.

## Assets déjà en place (à réutiliser, pas à recréer)
| Asset | Type | Rôle | ID Drive |
|-------|------|------|----------|
| **Pilotage Eat Sushi Manosque** | Google Sheet | KPIs resto (source de vérité) | `16LNpH29uvMFQQDE3WFBEgK_oyqi1YvoM2G6DsAh_Y7A` |
| Pilotage Eat Sushi — Agent Controller | Dossier | espace de l'agent de pilotage | `12lwmK8DTynDvUFyl320n-SR_6b3_Fni0` |
| MAKI ONE — Extraction Factures | Apps Script | extraction des factures | `1nKYlpXBRyBaGntDmh0-WPzBP35fzKnJJ...` |
| MAKI ONE — Gmail PDF → Drive FACTURES | Apps Script | Gmail → Drive | `16-20VWSJU9kba7cF_sZSz2jywI33qFQg5...` |
| Webhook Factures MAKI ONE | Apps Script | webhook factures | `1FyumzwQlDNFKR5-ahTADMUK2o9lK7MdL...` |

## Structure du Pilotage (déjà définie dans le Sheet)
1. **CA quotidien** — `Date, CA_HT_total, CA_sur_place, CA_emporter, CA_livraison_propre,
   CA_agregateurs, couverts, tickets, panier_moyen, offerts_ht, food_cost_pct,
   heures_planifiees, heures_pointees, ecart_heures, labor_cost_pct, prime_cost_pct, notes`
2. **Factures fournisseurs** — `Date_facture, Fournisseur, Famille, Montant_HT, TVA_pct,
   Montant_TTC, Mode_paiement`
3. **Heures salariés** — `Date, Salarie, Poste, Heures_planifiees, Heures_pointees, Ecart,
   Taux_horaire_charge, Cout_reel`
4. **Synthèse mensuelle** — agrégats + `alerte_food_cost, alerte_labor_cost, alerte_prime_cost`

## Modules de connaissance à AJOUTER (ce qui manque)
Le Pilotage couvre les chiffres. Le Second Brain ajoute le savoir qualitatif :
- **Fournisseurs** — référentiel (Eat Sushi Réseau, boissons, emballages…) → sert la machine Compta.
- **Menu / produits** — carte, prix, food cost par recette.
- **Marketing local** — ton de marque, posts validés, marronniers (fêtes, offres) → machine Contenu.
- **Avis & e-réputation** — Google/TripAdvisor/Uber Eats → à suivre.

## Rôle dans l'OS
- **Lecture :** l'orchestrateur lit le Pilotage avant de produire reporting ou contenu.
- **Écriture :** chaque machine écrit ses résultats dans le Pilotage / un module dédié
  (boucle d'amélioration : food cost, labor cost, prime cost surveillés mensuellement).

## Couche live — à arbitrer avec Ahmed
Deux options (voir question posée) :
- **A. Tout sur Google Sheets/Apps Script existant** (recommandé) — n8n/CLI orchestrent, ne dupliquent pas.
- **B. Référentiels qualitatifs en tables n8n** (Fournisseurs, Menu, Marketing) + Sheets pour les KPIs.
