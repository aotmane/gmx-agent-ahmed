# Skills — Missions de conseil au Maroc

Bibliothèque de skills opérationnels pour un agent (IA ou consultant) réalisant des
missions d'étude et de conseil pour des entreprises marocaines (TPE/PME, porteurs de projet).

Chaque skill suit le même format :

1. **Quand utiliser ce skill** — déclencheurs typiques.
2. **Informations à collecter auprès du client** — le brief minimal avant de commencer.
3. **Processus étape par étape** — la méthode de travail.
4. **Checklist qualité** — à vérifier avant de livrer.
5. **Modèle de livrable** — plan type du document final.
6. **Sources & références Maroc** — où chercher les données.
7. **Pièges fréquents** — erreurs à éviter dans le contexte marocain.

## Skills disponibles

| Skill | Mission | Livrable principal |
|---|---|---|
| [`etude-marche`](etude-marche/SKILL.md) | Étude et analyse de marché | Rapport d'étude de marché |
| [`analyse-financiere`](analyse-financiere/SKILL.md) | Diagnostic financier d'une entreprise | Rapport de diagnostic financier |
| [`previsionnel-financier`](previsionnel-financier/SKILL.md) | Business plan chiffré 3–5 ans | Prévisionnel financier complet |
| [`dossier-pret-bancaire`](dossier-pret-bancaire/SKILL.md) | Montage d'un dossier de crédit | Dossier bancaire complet |
| [`conseil-investissement`](conseil-investissement/SKILL.md) | Conseil financier & investissement | Note de conseil / plan d'action |
| [`complements`](complements/SKILL.md) | Création d'entreprise, fiscal, juridique | Notes et checklists |

## Enchaînement type d'une mission complète

```
Porteur de projet → etude-marche → previsionnel-financier → dossier-pret-bancaire
Entreprise existante → analyse-financiere → previsionnel-financier → dossier-pret-bancaire
Investisseur / trésorerie excédentaire → conseil-investissement
```

Le socle de connaissances commun (compétences, réglementation OEC/AMMC, écosystème
de financement) est documenté dans
[`docs/competences-etude-marche-finance-maroc.md`](../docs/competences-etude-marche-finance-maroc.md).

> ⚠️ **Garde-fous réglementaires** (valables pour tous les skills) :
> - Ne jamais produire d'états de synthèse certifiés ni se substituer à un
>   expert-comptable (activité réglementée — OEC).
> - Ne jamais recommander l'achat/vente d'instruments financiers précis sans
>   agrément AMMC : rester au niveau du conseil stratégique et pédagogique.
> - Toujours dater les chiffres cités (taux, barèmes fiscaux, programmes publics)
>   et recommander une vérification auprès de la source officielle.
