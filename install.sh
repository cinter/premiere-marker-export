#!/usr/bin/env bash
# Installs the Marker Export CEP panel into Premiere Pro on macOS.
# Enables loading of the unsigned panel, then symlinks it into the
# CEP extensions folder. Re-running is safe (idempotent).
set -euo pipefail

PANEL="com.texs.markerexport"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$PANEL"
EXT_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions"

if [ ! -d "$SRC" ]; then
    echo "ERROR: cannot find $PANEL next to this script ($SRC)." >&2
    exit 1
fi

echo "Enabling unsigned CEP extensions (PlayerDebugMode)…"
# Cover CEP 9–13 so it works across Premiere 2019 → 2026+.
for v in 9 10 11 12 13; do
    defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1 2>/dev/null || true
done
killall cfprefsd 2>/dev/null || true

echo "Installing panel into:"
echo "  $EXT_DIR/$PANEL"
mkdir -p "$EXT_DIR"
ln -sfn "$SRC" "$EXT_DIR/$PANEL"

echo
echo "Done. Now FULLY QUIT Premiere Pro and reopen it, then:"
echo "  Window → Extensions → Marker Export"
