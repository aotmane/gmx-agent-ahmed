# Inventaire des tâches — OTMANE OS

> Étape 0 (comme AFFISEO). On liste les tâches **répétitives et chronophages**, la solution
> attendue, et la **machine** qui l'exécutera. C'est le plan de construction de l'OS.

| Domaine | LA TÂCHE (avant) | LA SOLUTION ATTENDUE | LA MACHINE | Outils MCP / tech | Statut |
|---------|------------------|----------------------|------------|-------------------|--------|
| **Foundation** | Centraliser le savoir, les clients, les KPIs | Une base unique qui alimente les autres machines | `Second Brain` | Google Drive, n8n, data store | spec |
| **Email** | Trier la boîte GMX, repérer urgents/factures/clients | Tri auto par priorité + brouillons de réponse | `Email & Admin` | IMAP GMX, Gmail MCP | ✅ v1 |
| **Admin** | Relancer devis/factures non payés | Relances programmées automatiques | `Email & Admin` | Gmail, Calendar | spec |
| **Compta** | Récupérer factures, classer dépenses, préparer TVA | Extraction + catégorisation + export comptable | `Expert-comptable` | Drive, n8n, OCR | spec |
| **Compta** | Transmettre les pièces à l'expert-comptable | Dossier mensuel prêt + envoi auto | `Expert-comptable` | Drive, Gmail | spec |
| **Contenu** | Trouver des idées + écrire les scripts | Scraper l'actu + générer N scripts/jour dans mon style | `Contenu & Distribution` | n8n, APIs news, Second Brain | spec |
| **Contenu** | Produire vidéos/visuels | Avatar vidéo + visuels Canva/Gamma | `Contenu & Distribution` | génération vidéo, Canva, Gamma | spec |
| **Contenu** | Publier partout | Distribution multi-plateformes programmée | `Contenu & Distribution` | n8n / Make | spec |
| **Leads** | Trouver et capter des prospects | Sourcing + capture + qualification | `Leads` | n8n, Gmail, data store | spec |
| **Leads** | Relancer les prospects | Séquences email automatiques | `Leads` | Gmail, Calendar | spec |

## Légende des statuts
- `spec` : spécifié, pas encore construit
- `en cours` : en construction
- `✅ v1` : première version fonctionnelle

## Comment ajouter une tâche
1. Ajoute une ligne au tableau ci-dessus.
2. Rattache-la à une machine existante ou crée un dossier `machines/<nouvelle_machine>/`.
3. Décris le déclencheur + le flux dans le `README.md` de la machine.
4. Demande au CLI de construire/relier le workflow.
