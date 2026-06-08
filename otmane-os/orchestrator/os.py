#!/usr/bin/env python3
"""OTMANE OS — registre des machines (source de vérité unique).

Le « cerveau » est Claude Code (voir ../CLAUDE.md). Ce fichier n'exécute pas de
serveur : il décrit, pour chaque machine, son **modèle d'exécution** et son statut.
Tout l'OS tient sur un seul modèle : **Claude (Max) + MCP + Google Apps Script**,
sans aucun service Python hébergé.

  python os.py list            → tableau des machines
  python os.py show <machine>  → détail d'une machine (modèle d'exécution + comment l'utiliser)
"""
import argparse
import sys

# ── Registre canonique. README.md et INVENTORY.md doivent refléter ce tableau. ──
# name -> dict(status, model, desc, how)
#   model : "apps_script" | "claude+mcp" | "claude+python"
MACHINES = {
    "pilotage": {
        "status": "livré",
        "model": "apps_script",
        "desc": "Cockpit mobile (CA, food/labor/prime cost) + saisie + connecteurs Apitic/Combo/Caisse",
        "how": "Web App Apps Script (machines/pilotage/apps_script/Code.gs). Secrets en Script Properties.",
    },
    "accounting": {
        "status": "en cours",
        "model": "apps_script",
        "desc": "Factures→DÉPENSES, conformité, rapprochement bancaire, export expert-comptable",
        "how": ("Pipeline Apps Script (IngestFactures/WriteDepense/CheckConformite) + étape Claude "
                "(CLAUDE_STEP.md). Rapprochement : machines/accounting/bank-reconciliation/."),
    },
    "email_admin": {
        "status": "v1",
        "model": "claude+mcp",
        "desc": "Tri des e-mails Workspace par priorité + brouillons de réponse + relances",
        "how": "Claude + Gmail MCP (search_threads / create_draft / labels). Aucun serveur, aucun mot de passe.",
    },
    "second_brain": {
        "status": "spec",
        "model": "apps_script",
        "desc": "Source de vérité (KPIs + référentiels) qui alimente les autres machines",
        "how": "S'appuie sur les 2 Sheets existants (Pilotage + SUIVI DES DÉPENSES).",
    },
    "content": {
        "status": "spec",
        "model": "claude+mcp",
        "desc": "Idées → scripts → vidéo/visuels → distribution multi-plateformes",
        "how": "Claude + MCP génération vidéo/image, Gamma, Canva. (n8n self-hosted en option.)",
    },
    "leads": {
        "status": "spec",
        "model": "claude+mcp",
        "desc": "Sourcing, capture, qualification, relances, CRM léger",
        "how": "Claude + Gmail MCP + Calendar. CRM en Sheet/data store. (n8n self-hosted en option.)",
    },
}

MODEL_LABEL = {
    "apps_script": "Apps Script",
    "claude+mcp": "Claude + MCP",
    "claude+python": "Claude + Python",
}


def cmd_list(_args):
    print("OTMANE OS — machines (modèle unique : Claude Max + MCP + Apps Script)\n")
    for name, m in MACHINES.items():
        print(f"  [{m['status']:>8}] {name:<13} {MODEL_LABEL[m['model']]:<14} {m['desc']}")
    print("\nMoteur : Claude Code CLI (voir CLAUDE.md). Détail : python os.py show <machine>.")


def cmd_show(args):
    m = MACHINES.get(args.machine)
    if not m:
        print(f"Machine inconnue : {args.machine}. Connues : {', '.join(MACHINES)}", file=sys.stderr)
        sys.exit(1)
    print(f"{args.machine}  [{m['status']}]  — {MODEL_LABEL[m['model']]}\n")
    print(f"  Rôle  : {m['desc']}")
    print(f"  Exéc. : {m['how']}")
    print(f"  Doc   : machines/{args.machine}/README.md")


def main():
    parser = argparse.ArgumentParser(prog="otmane-os", description="Registre des machines OTMANE OS")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("list", help="Lister les machines et leur statut").set_defaults(func=cmd_list)
    show_p = sub.add_parser("show", help="Détail d'une machine")
    show_p.add_argument("machine", help="Nom de la machine (ex. pilotage)")
    show_p.set_defaults(func=cmd_show)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
