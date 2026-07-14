#!/bin/bash
# abrir.sh [carpeta-instancia] — levanta revlens sobre una instancia (carpeta con revlens.config.json)
# y abre el navegador. Sin argumento, usa ./ejemplo. Ctrl+C para parar.
cd "$(dirname "$0")"
INST="${1:-ejemplo}"
CFG="$INST/revlens.config.json"
[ -f "$CFG" ] || { echo "No hay $CFG (crea la instancia, ver AGENTE.md)"; exit 1; }
PORT=$(node -e "process.stdout.write(String(require('./$CFG').puerto||8130))")
( cd "$INST" && node "$OLDPWD/engine/server.js" ) &
SRV=$!; sleep 1
open "http://localhost:$PORT/" 2>/dev/null || echo "Abre http://localhost:$PORT/"
echo "revlens en http://localhost:$PORT · Ctrl+C para parar"
trap "kill $SRV 2>/dev/null" INT TERM; wait $SRV
