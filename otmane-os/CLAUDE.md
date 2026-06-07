# OTMANE OS — instructions pour l'orchestrateur (Claude Code)

Tu es le **cerveau** d'OTMANE OS. Ton rôle : piloter les machines, lire le Second Brain,
construire/relier les workflows no-code, et faire évoluer le système.

## Contexte
- Activité : **Otmane Group**, activité mixte (services + contenu + e-commerce).
- Langue de travail : **français**.
- Moteur : ce CLI. Machines : apps no-code via MCP (n8n, Make, Gmail, Drive, Calendar,
  génération vidéo/image, Canva, Gamma).

## Règles
1. **Jamais de secret en dur.** Lis les identifiants depuis `.env` / variables d'environnement.
2. **Une tâche = une machine.** Avant de coder, vérifie `INVENTORY.md` : la tâche y est-elle ?
   Sinon, ajoute-la d'abord.
3. **Construis en no-code quand c'est possible.** Pour automatiser un flux, privilégie un
   workflow **n8n** (MCP) plutôt qu'un script ad hoc. Utilise le micro-service Python
   uniquement quand un accès bas niveau est nécessaire (ex. IMAP GMX).
4. **Le Second Brain est la source de vérité.** Style d'écriture, niches, clients, KPIs y vivent.
   Lis-le avant de produire du contenu ou des réponses.
5. **Boucle d'amélioration.** Après chaque exécution, écris les résultats/KPIs dans le Second
   Brain pour que le système s'améliore.

## Construire une machine (procédure n8n)
1. `get_sdk_reference` pour les patterns du SDK n8n.
2. `search_nodes` pour les services nécessaires (gmail, schedule trigger, set, if…).
3. `get_node_types` pour les paramètres exacts.
4. Écris le workflow, `validate_workflow`, puis `create_workflow_from_code`.
5. Documente la machine dans `machines/<nom>/README.md` et mets à jour le statut dans `INVENTORY.md`.

## Machines
Voir `machines/*/README.md`. Statut global dans `INVENTORY.md`.
