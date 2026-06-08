# Audit d'architecture — OTMANE OS

> Portée : **l'architecture du système OTMANE OS lui-même** (dépôt, orchestration, machines,
> sécurité, cohérence doc/code), pas l'audit métier Eat Sushi (voir `AUDIT.md`).
> Date : 2026-06-08 · Base : branche `claude/video-analysis-4rPNx`.

## 0. Verdict en une phrase
Bonne **structure conceptuelle** (machines autonomes, 1 dossier = 1 machine, secrets externalisés)
et une **couche Apps Script solide**, mais l'OS souffre d'un **double point d'entrée** (le déploiement
exécute encore le service GMX legacy **avec mot de passe en clair**), d'une **dérive doc↔code** (README/
INVENTORY décrivent n8n/Make alors que tout tourne en Apps Script), et d'une **vérité de statut éclatée
en 3 endroits** incohérents.

---

## 1. Architecture réelle (telle qu'implémentée)

```
                ┌─────────────────────────────────────────────┐
   CERVEAU      │  Claude Code CLI  (orchestration humaine)    │
                └───────────────┬─────────────────────────────┘
                                │ pousse/lit via Web App + MCP Drive/Gmail
        ┌───────────────────────┼───────────────────────────────────────┐
        ▼                       ▼                                        ▼
  Python (Flask)          Google Apps Script  (couche d'exécution)   Données
  • email_admin/service   • accounting/*.gs (Ingest, WriteDepense,    • Sheets DÉPENSES
    (sécurisé, .env)        CheckConformite)                            + Pilotage
  • gmx-proxy (RACINE,     • pilotage/*.gs (Cockpit, IngestCaisse,     • Drive MAKI ONE
    legacy, secret en dur)   Apitic, Combo)                            • Script Properties
  • orchestrator/os.py     ← secrets : Script Properties                 (secrets .gs)
    (routeur CLI)
  • accounting/bank-reconciliation/*.py  (parseur relevés, one-shot)
```

**Constat de fond :** deux modèles d'exécution coexistent (Python Flask **et** Apps Script) + un
orchestrateur CLI **qui n'est relié ni au déploiement ni à la couche Apps Script**. L'orchestrateur
est décoratif : le `Procfile` et les `.gs` vivent leur vie à côté.

---

## 2. Findings (par sévérité)

### 🔴 Critique

**A1 — Mot de passe GMX en clair, et c'est LUI qui est déployé.**
`gmx-proxy-service.py` (racine) contient `password: '@Le*2022*'` en dur, présent dans l'historique git
(commit `38fd2e4`). Or le `Procfile` lance précisément ce fichier :
```
web: python gmx-proxy-service.py
```
La réécriture sécurisée (`machines/email_admin/service.py`, secrets via `.env`) **existe mais n'est pas
branchée au déploiement**. Le « correctif » documenté dans le README n'a donc aucun effet en production.
→ **Action :** (1) **révoquer/changer** le mot de passe GMX immédiatement ; (2) faire pointer le `Procfile`
sur la machine sécurisée ; (3) purger le secret de l'historique (git filter-repo / BFG) ; (4) supprimer
le fichier legacy.

### 🟠 Élevé

**A2 — Double point d'entrée, orchestrateur court-circuité.**
Le déploiement (`Procfile`) exécute le service legacy ; l'orchestrateur (`orchestrator/os.py`) et la
machine sécurisée ne sont jamais appelés en prod. Résultat : la « façade unique » annoncée n'existe pas.
→ **Action :** `Procfile` → `web: python -m otmane_os …` ou `gunicorn` sur `email_admin.service:app`,
et supprimer le legacy.

**A3 — `os.py run email_admin` est cassé là où il est documenté.**
Depuis la racine (comme le README et le Procfile), `python otmane-os/orchestrator/os.py run email_admin`
lève `ModuleNotFoundError: No module named 'machines'` (le dossier `otmane-os/` n'est pas sur le
`sys.path`). Seul `list` fonctionne. Pas de packaging (`pyproject`/`setup`), import relatif fragile.
→ **Action :** transformer `otmane-os/` en package installable (ou ajouter la racine au `sys.path` dans
`os.py`), et tester `run`.

**A4 — Vérité de statut éclatée en 3 sources incohérentes.**
Le statut de chaque machine est déclaré dans **trois** endroits qui se contredisent :
| Machine | README §3 | INVENTORY | `os.py` MACHINES |
|---|---|---|---|
| pilotage | « livré » | 🔧 livré | **absent du registre** |
| accounting | spec/“en cours” | spec | **`spec`** (alors que .gs + parseur livrés) |
| email_admin | ✅ v1 | ✅ v1 | v1 |
→ **Action :** une **seule** source de vérité (le registre `os.py`, ou un `INVENTORY.md` généré), et y
ajouter `pilotage` + le sous-module `bank-reconciliation`.

### 🟡 Moyen

**A5 — Dérive doc↔code sur la stack (n8n/Make vs Apps Script).**
`README` et `INVENTORY` présentent encore la couche machines comme **n8n/Make + data store MCP**, alors
que `AUDIT.md` a acté le pivot « **Claude Max only / Apps Script, zéro SaaS payant** » — et que **tout le
code réel est en Apps Script**. Les colonnes « Outils MCP » de l'INVENTORY (n8n, data store) ne reflètent
pas la réalité. Risque : un futur contributeur (ou toi dans 3 mois) construit pour la mauvaise cible.
→ **Action :** aligner README + INVENTORY sur Apps Script ; ne garder n8n qu'en option « self-hosted si
nécessaire ».

**A6 — Deux `requirements.txt`, le déploiement utilise le mauvais.**
Racine = `flask` seul (utilisé par le Procfile) ; `otmane-os/requirements.txt` = `flask + python-dotenv`.
La prod legacy n'installe donc pas `python-dotenv` (sans gravité tant que le legacy ignore `.env`, mais
incohérent dès qu'on bascule sur la machine sécurisée).
→ **Action :** un seul fichier de dépendances faisant foi, aligné avec le `Procfile` cible.

**A7 — Machine `accounting` à deux moitiés non reliées.**
La machine mêle Apps Script (`.gs`, pipeline factures) **et** un parseur Python autonome
(`bank-reconciliation/parse_releve.py`, validé au centime). Mais **aucun pont** : le `ledger_unifie.csv`
n'est ré-injecté dans le Sheet par aucune étape câblée, et `importerReleve()` (l'import cassé d'origine)
n'est toujours pas corrigé. Le parseur est un **outil one-shot**, pas un maillon de la machine.
→ **Action :** décider du contrat — soit un `.gs` qui applique la logique colonne→signe, soit une étape
Claude/`WriteDepense`-like qui pousse le ledger ; documenter le flux dans le README de la machine.

**A8 — Gestion des secrets « à deux têtes » non cartographiée.**
Python → `.env` ; Apps Script → Script Properties (`WRITE_SECRET`, `APITIC_*`, `COMBO_*`). C'est sain,
mais **aucun document ne liste où vit chaque secret** ni la procédure de rotation. `.env.example` ne
couvre que le Python.
→ **Action :** une section « Inventaire des secrets » (clé → emplacement → rotation).

### 🟢 Hygiène / faible

- **A9 —** `gmx-proxy-service.py` : bloc `__main__` mal indenté (`port`/`app.run` au niveau module → la
  ligne `app.run` s'exécute à l'import). Disparaît si on supprime le fichier (A1).
- **A10 —** Aucun test ni CI. Le parseur s'auto-valide à l'exécution (bien), mais rien ne garde la
  non-régression côté Python/`.gs`. → un test minimal sur un PDF échantillon + un lint Apps Script.
- **A11 —** Données générées versionnées (`ledger_unifie.csv`, `rapprochement_factures.csv`). Acceptable
  comme livrable, mais à isoler de la logique (dossier `data/` ou artefacts non suivis).
- **A12 —** `Second Brain`, `content`, `leads` = **spec pure** (README seulement). Le « Second Brain »,
  présenté comme cœur central, n'est aujourd'hui qu'un renvoi vers les 2 Sheets — pas de machine.

---

## 3. Ce qui est bien (à conserver)
- **Découpage en machines** clair : 1 dossier = 1 machine, chacune avec README (tâche/déclencheur/flux/
  outils/statut). Lisible et extensible.
- **Couche Apps Script mûre** : secrets en Script Properties, fuseau `Europe/Paris` corrigé, triggers
  natifs remplaçant Make (P6), upserts idempotents, connecteurs autonomes (Apitic/Combo/Caisse).
- **Rigueur du parseur bancaire** : auto-validation au centime contre les totaux imprimés (17/17 relevés).
- **Intention sécurité** : `.gitignore` couvre `.env`, `.env.example` fourni, contraintes documentées.
- **AUDIT.md métier** complet et honnête (points de douleur chiffrés).

---

## 4. Plan d'action priorisé
1. 🔴 **A1** — rotation du mot de passe GMX + Procfile → machine sécurisée + purge historique + suppression legacy.
2. 🟠 **A4 / A2 / A3** — registre de statut unique, brancher l'orchestrateur, réparer `run` (packaging).
3. 🟡 **A5** — réaligner README/INVENTORY sur « Apps Script / Claude Max only ».
4. 🟡 **A7** — câbler le rapprochement bancaire dans la machine `accounting` (corriger `importerReleve()`).
5. 🟢 **A6 / A8 / A10** — un seul requirements, inventaire des secrets, test minimal + CI.

> Tableau de bord de l'audit : 1 critique, 3 élevés, 4 moyens, 4 hygiène. Aucun ne remet en cause le
> découpage en machines — ce sont surtout des **problèmes de câblage et de cohérence**, pas de conception.
