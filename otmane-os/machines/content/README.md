# Machine 4 — Contenu & Distribution

**Tâche :** trouver des idées, écrire les scripts dans ton style, produire vidéos/visuels, et
publier sur toutes les plateformes — comme le cœur d'AFFISEO OS.

**Statut :** spec

## Flux
```
Scraping actu (APIs)  →  Second Brain (style + niches)  →  N scripts/jour
   →  génération vidéo (avatar) + visuels (Canva/Gamma)  →  distribution multi-plateformes
   →  KPIs réinjectés dans le Second Brain
```

## Étapes
1. **Idées** — scraper l'actualité des niches via APIs news (`NEWS_API_KEY`).
2. **Scripts** — générer `SCRIPTS_PER_DAY` (def. 7) scripts dans le ton défini au Second Brain.
3. **Production** — vidéo avatar (génération vidéo MCP) ; visuels et carrousels via **Canva** ;
   docs/landing via **Gamma**.
4. **Distribution** — publication programmée LinkedIn / Instagram / TikTok via **n8n** ou **Make**.
5. **Mesure** — récupérer vues/likes → écrire dans le Second Brain (amélioration continue).

## Outils MCP
Génération vidéo/image · Canva · Gamma · n8n / Make · (optionnel) virality_predictor pour
tester un hook avant publication.

## À définir avec toi
- Plateformes prioritaires, cadence de publication, comptes/connexions, ton de marque.
