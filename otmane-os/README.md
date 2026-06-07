# OTMANE OS

Un « OS » personnel d'automatisation piloté par l'IA, inspiré de l'architecture **AFFISEO OS**
mais adapté à l'activité réelle : **Eat Sushi Manosque** (restaurant, exploité par **MAKI ONE SAS**),
sous le holding **Groupe Otmane Investissement**.

> **Moteur (cerveau) :** Claude Code CLI — orchestre, génère et fait évoluer les machines.
> **Machines (exécution) :** apps no-code connectées en MCP (n8n / Make, Gmail, Google Drive,
> Google Calendar, génération vidéo/image, Gamma, Canva) + micro-services Python.
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

## 3. Les 5 machines

| # | Machine | Rôle | Dossier |
|---|---------|------|---------|
| 1 | **Email & Admin** | Tri intelligent GMX/Gmail, brouillons de réponse, relances | `machines/email_admin/` |
| 2 | **Expert-comptable** | Factures, TVA, catégorisation des dépenses, export comptable | `machines/accounting/` |
| 3 | **Second Brain** | Base de connaissance + dashboards/KPI qui nourrissent les autres | `machines/second_brain/` |
| 4 | **Contenu & Distribution** | Idées → scripts → vidéo/visuels → publication multi-plateformes | `machines/content/` |
| 5 | **Leads** | Prospection, capture, relance email, CRM | `machines/leads/` |

Chaque dossier de machine contient un `README.md` qui décrit : la tâche, le déclencheur,
le flux, les **outils MCP** utilisés, et l'état (`spec` / `en cours` / `prod`).

## 4. Stack technique

| Couche | Outil | Statut |
|--------|-------|--------|
| Orchestrateur | **Claude Code CLI** | cerveau |
| Workflows no-code | **n8n** / **Make** (MCP) | machines |
| Email | **Gmail** (MCP) + service IMAP GMX (`email_admin`) | machine 1 |
| Stockage / docs | **Google Drive** (MCP) | partagé |
| Agenda | **Google Calendar** (MCP) | partagé |
| Vidéo / visuels | génération vidéo-image + **Canva** + **Gamma** (MCP) | machine 4 |
| Secrets | fichier `.env` (jamais commité) | sécurité |

## 5. Sécurité (à lire avant tout)

- **Aucun secret en dur.** Tous les identifiants passent par `.env` (voir `.env.example`).
- ⚠️ L'ancien `gmx-proxy-service.py` (racine du repo) contient un **mot de passe GMX en clair**,
  présent dans l'historique git → **à changer / révoquer**. La machine 1 le remplace par
  une config par variables d'environnement.
- `.env` est ignoré par git (voir `.gitignore`).

## 6. Démarrage

```bash
cp otmane-os/.env.example otmane-os/.env   # puis remplis tes secrets
pip install -r otmane-os/requirements.txt
python otmane-os/orchestrator/os.py --help
```

## 7. Feuille de route (les « étapes » adaptées)

- [x] **Étape 0 — Inventaire** des tâches (`INVENTORY.md`)
- [x] **Étape 1 — Machine Email & Admin** (refactor sécurisé du service GMX)
- [ ] **Étape 2 — Second Brain** (base de connaissance + KPIs)
- [ ] **Étape 3 — Expert-comptable** (pipeline factures/TVA)
- [ ] **Étape 4 — Contenu & Distribution**
- [ ] **Étape 5 — Leads & CRM**
- [ ] **Étape 6 — Boucle d'amélioration** (les perfs réinjectées dans le Second Brain)
