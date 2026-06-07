# Étape Claude — De la file `INBOX_FACTURES` à `DÉPENSES`

> Le maillon « intelligent » du pipeline factures. L'ingestion (Apps Script) range les PDF et
> remplit la file ; **Claude** lit chaque PDF, extrait les champs comptables et écrit la ligne
> propre dans `DÉPENSES` via l'endpoint sécurisé `WriteDepense`.
>
> 100 % abonnement Claude Max : c'est Claude (cette session / Claude Code) qui exécute, à la
> demande (« traite ma file de factures ») ou en routine.

## Pipeline complet
```
Gmail ─[IngestFactures.gs, horaire]→ Drive /MAKI ONE/<exercice>/<mois>/
                                     └→ file INBOX_FACTURES (statut À_TRAITER)
                                            │
              ┌─────────────────────────────┘
              ▼   ÉTAPE CLAUDE (ce document)
   1. lire les lignes À_TRAITER de INBOX_FACTURES   (Drive : read_file_content)
   2. pour chacune, lire le PDF (Drive_URL → read_file_content, supporte le PDF)
   3. extraire les 15 champs (schéma ci-dessous) + appliquer les règles
   4. appeler WriteDepense ?secret=…&c0=…&…&c14=…   (insère + marque la file)
              ▼
   DÉPENSES (ligne propre)  →  DASHBOARD se met à jour
```

## Schéma d'extraction (paramètres de l'endpoint)
| Param | Colonne | Champ | Règle |
|------|---------|-------|------|
| `c0` | A | Clé interne (dedup) | `FAC-<AAAA>-<num_facture>` (AAAA = année de la facture) |
| `c1` | B | Date facture | `JJ/MM/AAAA` |
| `c2` | C | Fournisseur | nom légal lisible |
| `c3` | D | N° facture fournisseur | tel quel |
| `c4` | E | Catégorie | **une des 13 valeurs** (voir liste) |
| `c5` | F | Description | courte, lisible |
| `c6` | G | Mode paiement | Virement / Prélèvement / CB / Espèces… |
| `c7` | H | Montant HT (€) | nombre, point décimal |
| `c8` | I | Taux TVA (%) | nombre (ex. `20`, `5.5`, `0`) |
| `c9` | J | TVA (€) | nombre |
| `c10`| K | Montant TTC (€) | nombre |
| `c11`| L | Payé | `Oui` / `Non` |
| `c13`| N | Conformité | `Conforme` ou `À vérifier — <raison>` |
| `c14`| O | Commentaires | notes (TVA mixte, entité, etc.) |
| `messageId` | — | (file) | pour marquer INBOX_FACTURES en TRAITÉ |
| `secret` | — | auth | = Script Property `WRITE_SECRET` |

### Catégories valides (sans accents → normalisées côté script)
`Matieres premieres` · `Boissons` · `Emballages` · `Loyer & Charges` · `Equipements` ·
`Entretien` · `Marketing` · `Honoraires` · `Transport` · `IT et Logiciels` · `Livraison` ·
`Salaires` · `Divers`

## Règles métier (contrôles de conformité)
1. **Cohérence montants** : `HT + TVA ≈ TTC` (tolérance 0,02 €). Sinon `À vérifier — écart montants`.
2. **TVA mixte** (ex. 5,5 % poisson + 20 % transport) : renseigner le **taux dominant** dans `c8`,
   le **détail** en commentaire `c14`, et garder HT/TVA/TTC = totaux.
3. **Bon destinataire** : la facture doit être adressée à **MAKI ONE** (ou Eat Sushi Manosque).
   Sinon `À vérifier — entité <nom> ≠ MAKI ONE`.
4. **Autoliquidation UE** (fournisseur hors FR, n° TVA intracom, TVA 0 %) : noter en commentaire.
5. **Doublon** : la clé `c0` est dédoublonnée côté endpoint — ne pas réinjecter.
6. **Catégorie incertaine** → `Divers` + commentaire, jamais inventer une catégorie hors liste.

## Exemple validé (facture réelle Google Cloud)
> Démo exécutée sur un vrai PDF du Drive — l'extraction et le jugement fonctionnent.
```
c0  = FAC-2026-5530368573
c1  = 31/03/2026
c2  = Google Cloud EMEA Limited
c3  = 5530368573
c4  = IT et Logiciels
c5  = Google Workspace Business Standard (12–31 mars 2026, domaine odreams.ma)
c6  = Prélèvement
c7  = 30.31
c8  = 0
c9  = 0.00
c10 = 30.31
c11 = Non
c13 = À vérifier — facturé à « ABS LEADER GROUPE » (entité ≠ MAKI ONE) ; TVA 0% autoliquidation UE (n° TVA IE)
c14 = Reverse charge UE. Vérifier si la dépense relève bien de MAKI ONE.
```

## Appel de l'endpoint
`GET` (ou `POST`) :
```
{WRITE_DEPENSE_URL}?secret={WRITE_SECRET}
   &messageId=...&c0=...&c1=...&c2=...&c3=...&c4=...&c5=...&c6=...
   &c7=...&c8=...&c9=...&c10=...&c11=...&c13=...&c14=...
```
Tous les champs texte doivent être **URL-encodés**. Réponse JSON :
`{status:"ok", row:N}` · `{status:"skipped_duplicate"}` · `{status:"error", msg:"..."}`.

## Sécurité
- `WriteDepense` exige `WRITE_SECRET` (Script Property, **jamais commité**).
- ⚠️ L'ancien Web App « Extraction Factures » (`doGet`) écrit **sans authentification** :
  à sécuriser de la même manière (P7 de l'audit).
