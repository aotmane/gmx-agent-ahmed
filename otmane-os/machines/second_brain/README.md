# Machine 3 — Second Brain (Foundation)

**Tâche :** centraliser le savoir (niches, style d'écriture, clients, KPIs) en une source de
vérité unique qui **alimente toutes les autres machines**.

**Statut :** spec

## Pourquoi en premier
C'est la fondation d'AFFISEO OS. Sans Second Brain, le contenu n'a pas de « style », les leads
n'ont pas de contexte, le reporting n'existe pas. À construire avant Contenu et Leads.

## Contenu (modules, comme dans la vidéo)
- **Niches** — segments cibles d'Otmane Group.
- **SEO / GEO** — mots-clés, zones géographiques.
- **Copywriting & Persuasion** — ton de marque, exemples de posts validés.
- **Clients** — fiches clients, historique, statut.
- **KPIs** — vues, leads, CA, par plateforme et par mois (boucle d'amélioration).

## Implémentation proposée
- **Stockage :** Google Drive (docs/feuilles) via MCP + un `data store` n8n pour le structuré.
- **Lecture :** l'orchestrateur lit le Second Brain avant toute production.
- **Écriture :** chaque machine y écrit ses résultats après exécution (KPIs → amélioration continue).

## Outils MCP
Google Drive · n8n (data tables / data store) · Calendar (échéances).
