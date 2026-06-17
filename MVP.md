# Avizo — Cadrage produit (MVP)

Clone fonctionnel de **Dokaa** : un SaaS de marketing local pour commerces de proximité.
Cible : restaurants, salons de coiffure/beauté, hôtels, concessions auto, centres esthétiques.

## 1. Proposition de valeur

> Collectez plus d'avis Google, répondez automatiquement, et faites revenir vos clients par SMS — depuis une seule interface.

## 2. Périmètre fonctionnel

### MVP (v1) — l'indispensable
| Module | Description | Priorité |
|---|---|---|
| **Avis & e-réputation** | Connexion Google Business Profile, centralisation des avis, réponses assistées par IA (avec mots-clés SEO locaux). | P0 |
| **Collecte d'avis** | Génération d'un lien/QR code, demande d'avis par SMS après passage client. | P0 |
| **SMS marketing** | Campagnes ciblées, assistant IA de rédaction, envoi planifié. | P0 |
| **Base clients (CRM léger)** | Import/ajout de contacts, segments (nouveaux, fidèles, inactifs). | P0 |
| **Dashboard** | Note moyenne, volume d'avis, taux de réponse, ROI campagnes SMS. | P0 |
| **Auth & multi-établissement** | Compte, équipe, gestion de plusieurs points de vente. | P0 |

### v1.1 — différenciation
- Analyse de sentiment / détection des points de friction dans les avis.
- Multi-plateformes d'avis (TripAdvisor, Trustpilot, Facebook).
- Programme de fidélité / cartes de fidélité digitales.
- Facturation Stripe + plans (≈ 39 €/mois, sans engagement).

### Hors périmètre v1
Application mobile native, marketplace d'intégrations, white-label revendeurs.

## 3. Architecture technique proposée

```
Frontend (web app)      →  Next.js (React) + Tailwind CSS
Marketing site/landing  →  HTML/CSS statique (déjà initié : index.html)
Backend API             →  Python FastAPI  (ou Node/NestJS)
Base de données         →  PostgreSQL  +  Redis (files d'attente)
Auth                    →  JWT / OAuth (Google Business Profile)
Intégrations externes   →  Google Business Profile API, fournisseur SMS
                           (Twilio / Vonage / Brevo), Stripe, OpenAI/Claude (assistant IA)
Jobs asynchrones        →  worker (Celery / RQ) pour envois SMS & sync avis
Hébergement             →  conteneurs (le repo contient déjà Procfile + runtime Python)
```

> Le repo contient déjà un service Python Flask (`gmx-proxy-service.py`) et un `Procfile` :
> une bonne base pour démarrer le backend (scan IMAP → réutilisable pour des notifications/ingestion).
> Recommandation : migrer vers **FastAPI** pour l'API produit et garder Flask uniquement si besoin de compat.

## 4. Modèle de données (esquisse)

- `Organization` (commerce) → `Location` (établissement) → `User` (équipe)
- `Customer` (contact) → `Segment`
- `Review` (avis : source, note, texte, réponse, sentiment)
- `Campaign` (SMS : audience, message, statut, métriques) → `Message`
- `Subscription` (plan, statut Stripe)

## 5. Parcours utilisateur clé (collecte d'avis)

1. Le client paie / quitte le commerce.
2. Avizo envoie un SMS avec un lien personnalisé.
3. Client satisfait → redirigé vers Google pour laisser un avis.
4. L'avis remonte dans Avizo → réponse IA proposée → publiée.
5. Le dashboard met à jour la note moyenne et le ROI.

## 6. Prochaines étapes suggérées

1. Valider l'identité visuelle (logo SVG + charte) ✅ initié.
2. Maquetter la landing (`index.html`) ✅ initié.
3. Choisir la stack backend définitive (FastAPI recommandé).
4. Brancher Google Business Profile + un fournisseur SMS sur un POC.
5. Construire le dashboard avis + 1ʳᵉ campagne SMS de bout en bout.
