#!/usr/bin/env bash
#
# Start only the IndicXlit transliteration backend.
#
# The model paths inside the backend are relative, so it must run with its
# working directory set to backend/ — that is the whole reason this exists
# rather than a plain npm script.
#
#   npm run backend              http://127.0.0.1:8000
#   PORT=8001 npm run backend    different port
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
VENV="$BACKEND/.venv"

die() { printf "\033[31merror:\033[0m %s\n" "$1" >&2; exit 1; }

[ -x "$VENV/bin/python" ] ||
  die "Python environment missing. Run: npm run setup"

[ -f "$BACKEND/transformer/indicxlit.pt" ] ||
  die "Transliteration model missing. Run: npm run setup"

cd "$BACKEND"
exec "$VENV/bin/python" api_server.py
