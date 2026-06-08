# Inventaire des tâches — OTMANE OS

> Étape 0 (comme AFFISEO). On liste les tâches **répétitives et chronophages**, la solution
> attendue, et la **machine** qui l'exécutera. C'est le plan de construction de l'OS.

> **Modèle unique :** chaque machine est en **Apps Script** ou en **Claude + MCP** — aucun
> service Python hébergé, aucun SaaS payant. Statut canonique : `orchestrator/os.py`.

| Domaine | LA TÂCHE (avant) | LA SOLUTION ATTENDUE | LA MACHINE | Outils / tech | Statut |
|---------|------------------|----------------------|------------|---------------|--------|
| **Foundation** | Centraliser le savoir, les clients, les KPIs | Une base unique qui alimente les autres machines | `Second Brain` | Sheets + Apps Script | spec |
| **Pilotage** | Suivre CA, food/labor/prime cost | Cockpit mobile + saisie auto du CA | `Pilotage` | Apps Script Web App + Sheets | 🔧 livré |
| **Pilotage** | Saisir le CA sans ressaisie manuelle | Ingestion auto des exports de caisse + connecteurs Apitic/Combo | `Pilotage` | Apps Script (CAISSE/Apitic/Combo) | 🔧 livré |
| **Email** | Trier la boîte Workspace, repérer urgents/factures/clients | Tri auto par priorité + brouillons de réponse | `Email & Admin` | **Claude + Gmail MCP** | ✅ v1 |
| **Admin** | Relancer devis/factures non payés | Relances programmées automatiques | `Email & Admin` | Gmail MCP + Calendar MCP | spec |
| **Compta** | Récupérer factures, classer dépenses, préparer TVA | Extraction + catégorisation + export comptable | `Expert-comptable` | Apps Script + étape Claude | 🔧 en cours |
| **Compta** | Contrôler la conformité des factures | HT+TVA=TTC, doublons, fournisseur connu | `Expert-comptable` | Apps Script `CheckConformite.gs` | 🔧 livré |
| **Compta** | Rapprocher factures ↔ banque (CM + BNP) | Import relevés PDF validé + matching | `Expert-comptable` | Python (`bank-reconciliation/`) + Claude | 🔧 livré (P1) |
| **Compta** | Transmettre les pièces à l'expert-comptable | Dossier mensuel prêt + envoi auto | `Expert-comptable` | Drive MCP + Gmail MCP | spec |
| **Contenu** | Trouver des idées + écrire les scripts | Scraper l'actu + générer N scripts/jour dans mon style | `Contenu & Distribution` | Claude + Second Brain | spec |
| **Contenu** | Produire vidéos/visuels | Avatar vidéo + visuels Canva/Gamma | `Contenu & Distribution` | MCP génération vidéo, Canva, Gamma | spec |
| **Contenu** | Publier partout | Distribution multi-plateformes programmée | `Contenu & Distribution` | Apps Script / n8n self-hosted | spec |
| **Leads** | Trouver et capter des prospects | Sourcing + capture + qualification | `Leads` | Claude + Gmail MCP + Sheet CRM | spec |
| **Leads** | Relancer les prospects | Séquences email automatiques | `Leads` | Gmail MCP + Calendar MCP | spec |

## Légende des statuts
- `spec` : spécifié, pas encore construit
- `🔧 en cours` : en construction
- `✅ v1` / `🔧 livré` : version fonctionnelle livrée

## Comment ajouter une tâche
1. Ajoute une ligne au tableau ci-dessus.
2. Rattache-la à une machine existante ou crée un dossier `machines/<nouvelle_machine>/`.
3. Décris le déclencheur + le flux dans le `README.md` de la machine.
4. Demande au CLI de construire/relier le workflow.
