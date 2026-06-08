# Machine 1 — Email & Admin

**Tâche :** trier la boîte e-mail (Google Workspace), repérer urgents/factures/clients,
préparer des brouillons de réponse, relancer les impayés.

**Statut :** ✅ v1 (tri par priorité via Gmail MCP) · 🔜 brouillons + relances

**Modèle d'exécution :** **Claude + Gmail MCP** — aucun serveur, aucun mot de passe.

## Flux
```
Gmail / Workspace ─[Gmail MCP : search_threads]→ Claude classe (urgent/important/normal/spam)
                                                 ├→ create_draft  (brouillons de réponse)
                                                 └→ label_thread  (tri + suivi des relances)
```

## Pourquoi pas de service GMX/IMAP ?
La v0 était un service Flask qui scrutait une boîte **GMX** (`a.otmane@gmx.fr`) en IMAP avec un
**mot de passe en clair** — un reliquat du tout premier prototype, sans utilité pour l'activité
(qui tourne sur Google Workspace : `manosque@eatsushi.fr`). Il a été **retiré** : Claude accède
nativement à Gmail via le **connecteur MCP**, ce qui supprime le serveur, l'hébergement et le secret.

## Ce qui est fait (v1)
- Tri par priorité directement dans Claude à partir des fils Gmail (mots-clés
  *urgent / facture / impôt / client / banque…* → urgent / important / normal / spam).
- Aucune infrastructure : pas de Flask, pas de dyno, pas de `.env`.

## À venir
- **Brouillons de réponse** (`create_draft`) pour les e-mails `urgent`/`important`.
- **Relances** devis/factures non payés (couplé à la machine `accounting` + Calendar MCP).
- **Labels** de suivi (`label_thread`) pour matérialiser le tri et l'état des relances.

## Comment l'utiliser
Demande simplement à Claude, p.ex. : « trie ma boîte des 7 derniers jours et prépare des
brouillons pour les urgents ». Claude utilise le Gmail MCP (`search_threads`, `create_draft`,
`label_thread`).
