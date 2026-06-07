# Machine 1 — Email & Admin

**Tâche :** trier la boîte GMX/Gmail, repérer urgents/factures/clients, préparer des réponses,
relancer les impayés.

**Statut :** ✅ v1 (tri par priorité) · 🔜 brouillons de réponse + relances

## Flux
```
Boîte GMX (IMAP)  →  scan + classification priorité  →  API JSON  →  (à venir) brouillons Gmail
                                                                    →  (à venir) relances programmées
```

## Ce qui est fait (v1)
- Service Flask `service.py` : `/health`, `/scan?days=7&limit=20`, `/test-connection`.
- Classification par mots-clés (urgent / important / normal / spam), règles éditables dans
  `PRIORITY_RULES`.
- **Config 100% par variables d'environnement** (`.env`) — plus aucun mot de passe en dur.

## Lancer
```bash
cp ../../.env.example ../../.env   # remplis GMX_EMAIL / GMX_PASSWORD
pip install -r ../../requirements.txt
python service.py
curl localhost:5000/scan?days=7
```

## À venir (outils MCP)
- **Gmail MCP** : générer des brouillons de réponse pour les emails `urgent`/`important`.
- **Calendar MCP** : programmer les relances de devis/factures non payés.
- **n8n** : déclencheur planifié (scan toutes les heures) + routage des notifications.

## Sécurité
⚠️ Le mot de passe GMX historique (`@Le*2022*`) est exposé dans d'anciens commits → **à changer**.
Cette machine ne lit plus que `os.environ`.
