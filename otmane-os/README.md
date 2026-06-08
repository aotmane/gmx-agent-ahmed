# OTMANE OS

Un « OS » personnel d'automatisation piloté par l'IA, inspiré de l'architecture **AFFISEO OS**
mais adapté à l'activité réelle : **Eat Sushi Manosque** (restaurant, exploité par **MAKI ONE SAS**),
sous le holding **Groupe Otmane Investissement**.

> **Moteur (cerveau) :** Claude Code CLI — orchestre, génère et fait évoluer les machines.
> **Machines (exécution) — modèle unique :** **Google Apps Script** (gratuit, déclencheurs natifs)
> **et/ou Claude + MCP** (Gmail, Drive, Calendar, génération vidéo/image, Gamma, Canva).
> **Aucun service Python hébergé, aucun SaaS payant.**
>
> Tu ne codes pas à la main : le CLI pilote, les machines exécutent.

---

## 1. Principe directeur : « les Machines »

Comme AFFISEO, l'OS n'est **pas une appli monolithique**. C'est un assemblage de **machines
autonomes**, chacune réglant **une tâche répétitive et chronophage**. La règle de conception
de chaque machine suit l'inventaire (voir `INVENTORY.md`) :

```
LA TÂCHE (avant)  →  LA SOLUTION ATTENDUE  →  LA MACHINE qui l'exécute
```

## 2. Architecture en couches

```
┌──────────────────────────────────────────────────────────────────────┐
│  CERVEAU / ORCHESTRATION                                               │
│  • Claude Code CLI  ── pilote les machines, lit le Second Brain,       │
│                        écrit/relie les workflows, s'améliore en continu│
│  • Secrets via .env  ── aucun identifiant en dur                       │
└───────────────┬───────────────────────────────────────────────────────┘
                │
   ┌────────────┴────────────────────────────────────────────────┐
   │  🧠 SECOND BRAIN  (contexte central + reporting)             │
   │  Niches · SEO/GEO · Copywriting/Persuasion · KPIs · clients  │
   │  → alimente TOUTES les autres machines en savoir + style     │
   └──┬───────────────┬───────────────┬───────────────┬──────────┘
      │               │               │               │
 ┌────┴─────┐   ┌─────┴──────┐  ┌─────┴───────┐  ┌────┴─────────┐
 │ 📧 EMAIL │   │ 🧾 EXPERT- │  │ 🎬 CONTENU  │  │ 🎯 LEADS     │
 │  & ADMIN │   │  COMPTABLE │  │ & DISTRIB.  │  │ (acquisition)│
 └──────────┘   └────────────┘  └─────────────┘  └──────────────┘
```

## 3. Les machines

| Machine | Rôle | Modèle | Statut | Dossier |
|---------|------|--------|--------|---------|
| **Pilotage** | Cockpit mobile (CA, food/labor/prime cost) + saisie quotidienne | Apps Script | livré | `machines/pilotage/` |
| **Expert-comptable** | Factures, TVA, catégorisation, rapprochement bancaire, export | Apps Script | en cours | `machines/accounting/` |
| **Email & Admin** | Tri des e-mails Workspace, brouillons de réponse, relances | Claude + MCP | v1 | `machines/email_admin/` |
| **Second Brain** | Base de connaissance + KPIs qui nourrissent les autres | Apps Script | spec | `machines/second_brain/` |
| **Contenu & Distribution** | Idées → scripts → vidéo/visuels → publication multi-plateformes | Claude + MCP | spec | `machines/content/` |
| **Leads** | Prospection, capture, relance email, CRM | Claude + MCP | spec | `machines/leads/` |

> **Source de vérité du statut :** le registre `orchestrator/os.py` (`python orchestrator/os.py list`).
> Ce tableau et `INVENTORY.md` doivent le refléter.

Chaque dossier de machine contient un `README.md` qui décrit : la tâche, le déclencheur,
le flux, les **outils** utilisés, et l'état (`spec` / `en cours` / `livré`).

## 4. Stack technique — contrainte « Claude Max only »

Tout doit tourner sur l'**abonnement Claude Max + Google Workspace** : **aucun service SaaS
payant** (pas de n8n/Make cloud, pas de coûts d'API en plus). Voir `AUDIT.md`.

| Couche | Outil | Statut |
|--------|-------|--------|
| Cerveau | **Claude (Max)** / Claude Code | orchestrateur |
| Machines (exécution) | **Google Apps Script** (gratuit, déjà en place) | couche principale |
| Email | **Gmail via MCP** (Claude rédige/trie, aucun serveur) | machine Email & Admin |
| Données / Second Brain | **Google Sheets** (Pilotage + Suivi des dépenses) | source de vérité |
| Stockage / docs | **Google Drive** (MCP) | partagé |
| Agenda | **Google Calendar** (MCP) | partagé |
| Secrets | Script Properties (Apps Script) + `.env` pour les outils Python | sécurité |

> **Aucun service Python hébergé** : les machines sont en Apps Script ou en Claude + MCP.
> n8n/Make ne sont envisagés que **self-hosted gratuit** si vraiment nécessaire.

## 5. Sécurité (à lire avant tout)

- **Aucun secret en dur.** Apps Script → **Script Properties** ; outils Python → `.env` (ignoré par git).
- **Surface réduite :** plus aucun endpoint public ni service hébergé côté OS (le scanner GMX
  legacy `gmx-proxy-service.py`, qui contenait un mot de passe en clair, a été **supprimé**).
- ⚠️ Ce mot de passe GMX reste **dans l'historique git** (commit `38fd2e4`) → **à révoquer**
  côté compte GMX, et historique à purger (BFG / git-filter-repo) si la boîte existe encore.

## 6. Démarrage

```bash
python otmane-os/orchestrator/os.py list           # machines + statuts (source de vérité)
python otmane-os/orchestrator/os.py show pilotage  # détail d'une machine
```
Pas d'installation : les machines tournent en Apps Script (Google) ou via Claude + MCP.
Les rares outils Python (ex. `machines/accounting/bank-reconciliation/`) sont en bibliothèque
standard. `cp otmane-os/.env.example otmane-os/.env` uniquement si un outil le demande.

## 7. Feuille de route (les « étapes » adaptées)

- [x] **Étape 0 — Inventaire** des tâches (`INVENTORY.md`)
- [x] **Étape 1 — Email & Admin** (Gmail MCP ; service GMX legacy retiré)
- [x] **Étape 2 — Pilotage** (cockpit Apps Script + connecteurs Apitic/Combo/Caisse)
- [~] **Étape 3 — Expert-comptable** (ingestion + conformité + rapprochement bancaire livrés)
- [ ] **Étape 4 — Second Brain** (base de connaissance + KPIs)
- [ ] **Étape 5 — Contenu & Distribution**
- [ ] **Étape 6 — Leads & CRM**
- [ ] **Étape 7 — Boucle d'amélioration** (les perfs réinjectées dans le Second Brain)
