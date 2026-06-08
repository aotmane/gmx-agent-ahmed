# OTMANE OS — instructions pour l'orchestrateur (Claude Code)

Tu es le **cerveau** d'OTMANE OS. Ton rôle : piloter les machines, lire le Second Brain,
construire/relier les workflows no-code, et faire évoluer le système.

## Contexte
- Activité : **Eat Sushi Manosque** (restaurant sushi, exploité par **MAKI ONE SAS**),
  sous le holding **Groupe Otmane Investissement**. Contact : manosque@eatsushi.fr.
- Assets existants à réutiliser (voir `machines/second_brain/README.md`) : le Sheet
  « Pilotage Eat Sushi Manosque » et les Apps Scripts d'extraction de factures.
- Langue de travail : **français**.
- Moteur : ce CLI. **Modèle d'exécution unique : Claude (Max) + MCP + Google Apps Script.**
  MCP disponibles : Gmail, Drive, Calendar, génération vidéo/image, Gamma, Canva.
  **Aucun service Python hébergé, aucun SaaS payant** (pas de n8n/Make cloud). Voir `AUDIT.md`.

## Règles
1. **Jamais de secret en dur.** Apps Script → Script Properties ; tout le reste → MCP/`.env`.
   Aucun mot de passe dans le code ni dans git.
2. **Une tâche = une machine.** Avant de coder, vérifie `INVENTORY.md` : la tâche y est-elle ?
   Sinon, ajoute-la d'abord. La liste/statut **canonique** est le registre `orchestrator/os.py`.
3. **Reste sur le modèle unique.** Pour automatiser : **Apps Script** (déclencheurs natifs,
   gratuit) ou **Claude + MCP**. n8n/Make uniquement **self-hosted gratuit** si vraiment
   nécessaire. Un script Python n'est qu'un **outil ponctuel** (accès bas niveau), jamais un
   service hébergé.
4. **Le Second Brain est la source de vérité.** Style d'écriture, niches, clients, KPIs y vivent.
   Lis-le avant de produire du contenu ou des réponses.
5. **Boucle d'amélioration.** Après chaque exécution, écris les résultats/KPIs dans le Second
   Brain pour que le système s'améliore.

## Construire une machine
1. **Choisis le modèle** : Apps Script (flux récurrent sur Sheets/Drive/Gmail, déclencheur natif)
   ou Claude + MCP (raisonnement, e-mail, génération de contenu).
2. **Apps Script** : code dans `machines/<nom>/apps_script/`, secrets en Script Properties,
   fuseau `Europe/Paris`, déclencheur horaire natif (pas de webhook public si évitable).
3. **Claude + MCP** : décris le déroulé dans le README ; la machine = une capacité que Claude
   exécute (ex. Gmail MCP pour le tri/brouillons). Pas de serveur à héberger.
4. Documente la machine dans `machines/<nom>/README.md`.
5. Mets à jour le **registre canonique** `orchestrator/os.py` (statut + modèle) ; README et
   INVENTORY doivent refléter ce registre.

## Machines
Liste/statut canonique : `python orchestrator/os.py list`. Détail par machine :
`machines/*/README.md`.
