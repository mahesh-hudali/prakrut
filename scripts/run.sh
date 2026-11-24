#!/usr/bin/env bash
#
# Start everything: the IndicXlit transliteration backend and the Vite frontend.
#
# Self-bootstrapping — on a fresh machine this creates the Python virtualenv,
# installs both dependency sets and unpacks the model, then runs both servers.
# Re-running is cheap: each step is skipped when it is already done.
#
#   ./scripts/run.sh            start everything
#   ./scripts/run.sh --setup    install dependencies only, do not start
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
VENV="$BACKEND/.venv"
STAMP="$VENV/.requirements.sha"
MODEL_ZIP="$BACKEND/indicxlit-en-indic-v1.0.zip"
MODEL_URL="https://github.com/AI4Bharat/IndicXlit/releases/download/v1.0/indicxlit-en-indic-v1.0.zip"
BACKEND_LOG="$ROOT/backend.log"
SETUP_ONLY=${1:-}

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
info() { printf "  %s\n" "$1"; }
die() { printf "\033[31merror:\033[0m %s\n" "$1" >&2; exit 1; }

# ---------------------------------------------------------------- Python ----
# fairseq 0.12.2 does not build on Python 3.11+ (it relies on distutils).
pick_python() {
  for candidate in python3.10 python3.9 python3.8 python3; do
    command -v "$candidate" >/dev/null 2>&1 || continue
    local version
    version="$("$candidate" -c 'import sys; print("%d.%d" % sys.version_info[:2])')"
    case "$version" in
      3.8 | 3.9 | 3.10)
        echo "$candidate"
        return 0
        ;;
    esac
  done
  return 1
}

bold "Kannada Editor"

if [ ! -x "$VENV/bin/python" ]; then
  PYTHON="$(pick_python)" || die "Python 3.8, 3.9 or 3.10 is required (fairseq does not support 3.11+).
       macOS:  brew install python@3.10
       Ubuntu: sudo apt install python3.10 python3.10-venv"
  info "Creating virtualenv with $($PYTHON --version 2>&1)"
  "$PYTHON" -m venv "$VENV"
fi

# Reinstall only when requirements.txt actually changed.
REQ_SHA="$(shasum "$BACKEND/requirements.txt" | cut -d' ' -f1)"
if [ ! -f "$STAMP" ] && "$VENV/bin/python" -c 'import fairseq, flask, flask_cors' 2>/dev/null; then
  # Pre-existing venv that already works — adopt it rather than reinstalling.
  echo "$REQ_SHA" > "$STAMP"
fi

if [ "$(cat "$STAMP" 2>/dev/null)" != "$REQ_SHA" ]; then
  info "Installing Python dependencies (a few minutes on first run)…"
  # pip 24.1+ refuses to process omegaconf 2.0.6, whose metadata declares an
  # invalid "PyYAML (>=5.1.*)" requirement. fairseq 0.12.2 pins that version,
  # so the installer has to stay on the last pip that tolerates it.
  "$VENV/bin/python" -m pip install --quiet "pip<24.1" wheel
  "$VENV/bin/python" -m pip install --quiet -r "$BACKEND/requirements.txt"
  echo "$REQ_SHA" > "$STAMP"
else
  info "Python dependencies up to date"
fi

# ----------------------------------------------------------------- Model ----
if [ ! -f "$BACKEND/transformer/indicxlit.pt" ]; then
  if [ ! -f "$MODEL_ZIP" ]; then
    info "Downloading the IndicXlit model (~121 MB)…"
    curl -fL --progress-bar "$MODEL_URL" -o "$MODEL_ZIP" ||
      die "Could not download the model. Fetch it manually and place it at:
       $MODEL_ZIP
       $MODEL_URL"
  fi
  info "Unpacking the IndicXlit model…"
  unzip -q -o "$MODEL_ZIP" -d "$BACKEND"
fi
[ -f "$BACKEND/transformer/indicxlit.pt" ] || die "Model checkpoint missing after unpacking."

# -------------------------------------------------------------- Frontend ----
if [ ! -d "$ROOT/node_modules" ]; then
  command -v npm >/dev/null 2>&1 || die "Node.js 20+ is required. See https://nodejs.org"
  info "Installing Node dependencies…"
  (cd "$ROOT" && npm install --silent)
else
  info "Node dependencies up to date"
fi

if [ "$SETUP_ONLY" = "--setup" ]; then
  bold "Setup complete. Run ./scripts/run.sh to start."
  exit 0
fi

# ----------------------------------------------------------------- Serve ----
BACKEND_PID=""
cleanup() {
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

backend_healthy() { curl -fsS --max-time 1 http://127.0.0.1:8000/health >/dev/null 2>&1; }

if backend_healthy; then
  # Reuse it rather than starting a second one that cannot bind the port.
  info "Transliteration server already running on http://127.0.0.1:8000"
else
  info "Starting transliteration server on http://127.0.0.1:8000 (log: backend.log)"
  bash "$ROOT/scripts/backend.sh" > "$BACKEND_LOG" 2>&1 &
  BACKEND_PID=$!

  # The model has to finish loading, or the first suggestions silently fail.
  for _ in $(seq 1 60); do
    backend_healthy && break
    kill -0 "$BACKEND_PID" 2>/dev/null || {
      echo; tail -20 "$BACKEND_LOG"; die "Transliteration server exited. See backend.log"
    }
    sleep 1
  done
  backend_healthy || die "Transliteration server did not become ready. See backend.log"
  info "Transliteration model loaded"
fi

bold "Opening the editor at http://localhost:5173  (Ctrl+C stops everything)"
cd "$ROOT" && npm run dev
