#!/usr/bin/env bash
# ============================================================================
# OTMANE OS — Purge d'un secret de TOUT l'historique git
# ----------------------------------------------------------------------------
# À LANCER SUR TA MACHINE (pas dans l'environnement Claude), avec les droits de
# push sur le dépôt. Réécrit l'historique de TOUTES les branches (main inclus).
#
# Ce script ne contient AUCUN secret : tu le saisis au clavier à l'exécution.
#
# Pré-requis : git-filter-repo
#   • macOS   : brew install git-filter-repo
#   • Debian  : sudo apt install git-filter-repo
#   • pip     : pipx install git-filter-repo   (ou pip install git-filter-repo)
#   (Alternative BFG en bas de fichier.)
#
# Usage :
#   ./scripts/purge-git-secret.sh
# ============================================================================
set -euo pipefail

REMOTE_URL="${1:-}"
if [[ -z "$REMOTE_URL" ]]; then
  REMOTE_URL="$(git config --get remote.origin.url 2>/dev/null || true)"
fi
if [[ -z "$REMOTE_URL" ]]; then
  echo "Donne l'URL du dépôt en argument : ./scripts/purge-git-secret.sh <git-url>" >&2
  exit 1
fi

if ! command -v git-filter-repo >/dev/null 2>&1 && ! git filter-repo --version >/dev/null 2>&1; then
  echo "❌ git-filter-repo introuvable. Installe-le (voir l'entête), puis relance." >&2
  echo "   macOS: brew install git-filter-repo | Debian: sudo apt install git-filter-repo" >&2
  exit 1
fi

# 1) Secret saisi au clavier (jamais en argument ni dans l'historique shell)
read -rsp "Colle le secret à purger (mot de passe GMX), puis Entrée : " SECRET; echo
[[ -n "$SECRET" ]] || { echo "Secret vide, abandon." >&2; exit 1; }

# 2) Fichier de remplacements dans un dossier TEMP (hors dépôt)
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
REPL="$WORK/replacements.txt"
printf '%s==>@L<purged>\n' "$SECRET" > "$REPL"

# 3) Clone miroir (fresh) — filter-repo exige un clone propre pour tout réécrire
echo "▶ Clone miroir…"
git clone --mirror "$REMOTE_URL" "$WORK/repo.git"
cd "$WORK/repo.git"

# 4) Réécriture : le secret est remplacé dans TOUS les blobs de TOUTE l'histoire
echo "▶ Réécriture de l'historique…"
git filter-repo --force --replace-text "$REPL"

# 5) Pousse l'historique réécrit (TOUTES les refs)
echo
echo "Historique réécrit dans : $WORK/repo.git"
echo "⚠️  L'étape suivante FORCE-PUSH et réécrit main + toutes les branches du dépôt distant."
read -rp "Confirmer le push --force --mirror ? [tape OUI] : " OK
if [[ "$OK" == "OUI" ]]; then
  git push --force --mirror "$REMOTE_URL"
  echo "✅ Historique distant réécrit. Le secret n'apparaît plus dans les blobs."
else
  echo "⏸  Push annulé. Tu peux inspecter $WORK/repo.git puis pousser manuellement :"
  echo "     cd $WORK/repo.git && git push --force --mirror $REMOTE_URL"
  trap - EXIT   # on garde le dossier pour inspection
fi

cat <<'NEXT'

────────────────────────────────────────────────────────────────────────────
APRÈS LA PURGE — indispensable :
  1. 🔑 CHANGE le mot de passe GMX (la purge ne « dé-fuite » pas un secret déjà
     exposé : considère-le compromis tant qu'il n'est pas changé).
  2. ♻️  Tous les clones existants sont obsolètes → re-clone propre, ou :
        git fetch --all && git reset --hard origin/<branche>
  3. 🧹 Les anciens commits peuvent rester en cache GitHub (PRs, vues) un moment ;
     GitHub finit par les GC. Au besoin, ouvre un ticket support pour forcer le GC.
────────────────────────────────────────────────────────────────────────────

# ── Alternative BFG (si pas de git-filter-repo, Java requis) ───────────────
#   1) Télécharge bfg.jar : https://rtyley.github.io/bfg-repo-cleaner/
#   2) echo 'TON_SECRET' > /tmp/secrets.txt
#   3) git clone --mirror <git-url> repo.git
#   4) java -jar bfg.jar --replace-text /tmp/secrets.txt repo.git
#   5) cd repo.git && git reflog expire --expire=now --all && git gc --prune=now --aggressive
#   6) git push --force --mirror
#   7) rm /tmp/secrets.txt   (puis change le mot de passe GMX)
NEXT
