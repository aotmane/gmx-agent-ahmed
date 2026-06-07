# Machine 5 — Leads (Acquisition)

**Tâche :** trouver et capter des prospects, les qualifier, les relancer automatiquement, et
les suivre dans un CRM léger.

**Statut :** spec

## Flux
```
Sourcing prospects  →  capture (formulaire / inbound email)  →  qualification (Second Brain)
   →  séquence de relance email  →  CRM (data store)  →  RDV (Calendar)
```

## Étapes
1. **Sourcing** — entrants depuis le contenu (machine 4) + sources externes.
2. **Capture** — leads stockés dans un `data store` n8n (nom, email, source, statut).
3. **Qualification** — scoring selon niches/critères du Second Brain.
4. **Relance** — séquences email automatiques (Gmail) espacées dans le temps.
5. **RDV** — proposition de créneaux via Calendar pour les leads chauds.

## Outils MCP
n8n (orchestration + data table = CRM) · Gmail (séquences) · Calendar (RDV) ·
Second Brain (qualification).

## À définir avec toi
- Définition d'un lead « qualifié », nombre d'étapes de relance, canaux, intégration CRM existant.
