#!/usr/bin/env bash
#
# Build a portable archive of the project.
#
# Excludes node_modules and the Python virtualenv: both are large and tied to
# the machine that built them (compiled wheels, absolute paths), and both are
# recreated by scripts/run.sh on the target machine.
#
#   ./scripts/package.sh              lean archive, model downloaded on setup
#   ./scripts/package.sh --with-model bundle the model too (works offline)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="$(basename "$ROOT")"
STAMP="$(date +%Y%m%d)"
WITH_MODEL=${1:-}

# Always excluded: rebuilt by scripts/run.sh, or machine-specific.
EXCLUDES=(
  "$NAME/node_modules/*"
  "$NAME/backend/.venv/*"
  "$NAME/dist/*"
  "$NAME/.git/*"
  "$NAME/backend/indicxlit-source/*"
  "$NAME/backend/__pycache__/*"
  "$NAME/backend.log"
  "$NAME/.DS_Store"
  "$NAME/*/.DS_Store"
)

if [ "$WITH_MODEL" = "--with-model" ]; then
  ARCHIVE="$HOME/Desktop/${NAME}-${STAMP}-with-model.zip"
  # Keep the downloaded archive, drop the extracted copy of the same bytes.
  EXCLUDES+=("$NAME/backend/transformer/*" "$NAME/backend/corpus-bin/*")
else
  ARCHIVE="$HOME/Desktop/${NAME}-${STAMP}.zip"
  EXCLUDES+=(
    "$NAME/backend/indicxlit-en-indic-v1.0.zip"
    "$NAME/backend/transformer/*"
    "$NAME/backend/corpus-bin/*"
  )
fi

ARGS=()
for pattern in "${EXCLUDES[@]}"; do
  ARGS+=(-x "$pattern")
done

rm -f "$ARCHIVE"

cd "$ROOT/.."
zip -r -q "$ARCHIVE" "$NAME" "${ARGS[@]}"

printf "\033[1mWrote %s (%s)\033[0m\n" "$ARCHIVE" "$(du -h "$ARCHIVE" | cut -f1)"
echo "On the target machine: unzip, then run ./scripts/run.sh"
