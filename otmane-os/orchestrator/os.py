#!/usr/bin/env python3
"""OTMANE OS — orchestrateur (point d'entrée).

Petit routeur en ligne de commande qui liste les machines et délègue l'exécution.
Le vrai « cerveau » reste Claude Code (voir ../CLAUDE.md) ; ce fichier sert de
table d'aiguillage et de point d'entrée local pour les machines codées.
"""
import argparse
import sys

# Registre des machines : nom -> (statut, description)
MACHINES = {
    "email_admin": ("v1", "Tri GMX par priorité + (à venir) brouillons/relances"),
    "accounting": ("spec", "Factures, TVA, catégorisation, export expert-comptable"),
    "second_brain": ("spec", "Base de connaissance centrale + KPIs"),
    "content": ("spec", "Idées → scripts → vidéo/visuels → distribution"),
    "leads": ("spec", "Sourcing, capture, relance, CRM"),
}


def cmd_list(_args):
    print("OTMANE OS — machines :\n")
    for name, (status, desc) in MACHINES.items():
        print(f"  [{status:>4}] {name:<14} {desc}")
    print("\nMoteur : Claude Code CLI (voir CLAUDE.md). Machines : MCP no-code + services Python.")


def cmd_run(args):
    name = args.machine
    if name not in MACHINES:
        print(f"Machine inconnue : {name}. Machines : {', '.join(MACHINES)}", file=sys.stderr)
        sys.exit(1)
    if name == "email_admin":
        # Délègue au service Flask de la machine 1.
        from machines.email_admin import service
        port = service.os.environ.get("PORT", "5000")
        print(f"Démarrage Email & Admin sur le port {port}…")
        service.app.run(host="0.0.0.0", port=int(port), debug=False)
    else:
        status = MACHINES[name][0]
        print(f"Machine '{name}' au statut '{status}' — pas encore exécutable. "
              f"Voir machines/{name}/README.md pour la spec.")


def main():
    parser = argparse.ArgumentParser(prog="otmane-os", description="Orchestrateur OTMANE OS")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("list", help="Lister les machines et leur statut").set_defaults(func=cmd_list)

    run_p = sub.add_parser("run", help="Lancer une machine")
    run_p.add_argument("machine", help="Nom de la machine (ex. email_admin)")
    run_p.set_defaults(func=cmd_run)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
