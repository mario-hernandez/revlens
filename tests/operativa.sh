#!/bin/bash
# Batería de OPERATIVA REAL de revlens (modo proxy) sobre 4 webs públicas, con contextos inventados
# que emulan lo que entraría un usuario. Incluye los casos adversariales de servidor (colisión /api,
# guardia del plano de control, SSRF por redirect). Usa SIEMPRE instancias y colas temporales.
# Uso: tests/operativa.sh   (desde cualquier cwd; requiere Node ≥18 y red)
set -u
ENG="$(cd "$(dirname "$0")/.." && pwd)/engine/server.js"
T=$(mktemp -d /tmp/revlens-operativa.XXXXXX)
GK="${GOOGLE_GENAI_API_KEY:-$(security find-generic-password -s gemini-api -w 2>/dev/null || true)}"
PASS=0; FAIL=0; PIDS=""
trap 'kill $PIDS 2>/dev/null' EXIT
ok(){ echo "    ✓ $1"; PASS=$((PASS+1)); }
ko(){ echo "    ✗ $1"; FAIL=$((FAIL+1)); }

instancia(){ # nombre url puntos puerto marcador_html contexto
  local n="$1" url="$2" pts="$3" port="$4" marca="$5" ctx="$6"
  local d="$T/$n"; mkdir -p "$d"
  cat > "$d/revlens.config.json" <<JSON
{ "titulo":"REVISIÓN · $n","puerto":$port,"producto":{"url":"$url"},
  "puntos":"$pts","contexto":"./contexto.md","cola":"./cola.jsonl",
  "ia":{"backend":"gemini","geminiModel":"gemini-2.5-flash"} }
JSON
  printf '%s\n' "$ctx" > "$d/contexto.md"
  echo "── $n · $url ──"
  GOOGLE_GENAI_API_KEY="$GK" REVLENS_CONFIG="$d/revlens.config.json" node "$ENG" > "$d/srv.log" 2>&1 &
  local pid=$!; disown; PIDS="$PIDS $pid"; sleep 1.6
  local B="http://127.0.0.1:$port"
  curl -sL --max-time 15 "$B/" | grep -qi "$marca" && ok "proxy sirve el HTML real" || ko "proxy NO sirvió el sitio"
  [ "$(curl -sL --max-time 15 "$B/" | grep -c '_rev/overlay.js')" = "1" ] && ok "overlay inyectado" || ko "overlay NO inyectado"
  curl -sIL --max-time 15 "$B/" | grep -qi "content-security-policy" && ko "CSP presente (bloquearía)" || ok "sin CSP"
  curl -s "$B/_rev/config" | grep -q "$n" && ok "config del overlay OK" || ko "config mal"
  local id=$(curl -s -X POST "$B/_rev/api/comentario" -H "X-Revlens: 1" -H 'Content-Type: application/json' -d '{"seccion":"test","ancla":"un punto","texto":"comentario de prueba"}' | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
  [ -n "$id" ] && ok "crear comentario (id=$id)" || ko "no se creó"
  [ -f "$d/cola.jsonl.bak" ] && ok "backup .bak creado" || ko "sin backup"
  curl -s -X PUT "$B/_rev/api/comentario/$id" -H "X-Revlens: 1" -H 'Content-Type: application/json' -d '{"texto":"editado"}' >/dev/null
  [ "$(curl -s "$B/_rev/api/comentarios" -H "X-Revlens: 1" | python3 -c 'import json,sys;print(json.load(sys.stdin)[0]["texto"])' 2>/dev/null)" = "editado" ] && ok "editar comentario" || ko "no editó"
  curl -s -X DELETE "$B/_rev/api/comentario/$id" -H "X-Revlens: 1" >/dev/null
  [ "$(curl -s "$B/_rev/api/comentarios" -H "X-Revlens: 1" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)))' 2>/dev/null)" = "0" ] && ok "borrar comentario" || ko "no borró"
  if [ -n "$GK" ]; then
    curl -s --max-time 90 -X POST "$B/_rev/api/asesor" -H "X-Revlens: 1" -H 'Content-Type: application/json' -d "{\"mensaje\":\"PUNTO: «${marca}». MI INQUIETUD: ¿esto encaja con el objetivo? Termina con 📌 COMENTARIO:\"}" -o "$d/asesor-resp.json"
    python3 -c "import json;j=json.load(open('$d/asesor-resp.json'));t=j.get('texto') or '';print('OKPIN' if j.get('ok') and '📌' in t else 'NO: ok='+str(j.get('ok'))+' err='+str(j.get('error')))" 2>/dev/null | grep -q OKPIN && ok "asesor responde + 📌 COMENTARIO" || ko "asesor falló o sin 📌 (ver $d/asesor-resp.json)"
  else
    echo "    · asesor saltado (sin GOOGLE_GENAI_API_KEY ni keychain gemini-api)"
  fi
  kill $pid 2>/dev/null
}

instancia "landing-minimal" "https://motherfuckingwebsite.com" "p, h1, li, a" 8151 "website" \
"Eres asesor de una agencia de diseño web minimalista. El sitio es su manifiesto/landing; objetivo: que una pyme valore la sobriedad y contrate. Voz directa. Termina con 📌 COMENTARIO cuando haya acción."
instancia "articulo-largo" "https://www.gnu.org/philosophy/free-sw.html" "p, li, h2, h3, blockquote" 8152 "free software" \
"Eres asesor editorial de un blog técnico. El texto explica las libertades del software libre; objetivo: claridad para desarrolladores nuevos. Voz didáctica. Termina con 📌 COMENTARIO cuando haya acción."
instancia "pagina-historica" "https://info.cern.ch/hypertext/WWW/TheProject.html" "p, a, h1, dt, dd" 8153 "World Wide Web" \
"Eres asesor de comunicación de un proyecto de investigación. La página lo presenta; objetivo: divulgar y atraer colaboradores. Voz clara. Termina con 📌 COMENTARIO cuando haya acción."
instancia "doc-tecnica" "https://www.rfc-editor.org/rfc/rfc2324.html" "p, pre, h2" 8154 "HTCPCP" \
"Eres asesor de developer experience. Es documentación técnica de una API; objetivo: que un dev la entienda sin fricción. Voz precisa. Termina con 📌 COMENTARIO cuando haya acción."

# ── adversarial de servidor: sitio hostil local con /api propio y redirects ──
echo "── adversarial-servidor ──"
cat > "$T/hostil.js" <<'EOF'
require('http').createServer((q,s)=>{
  if(q.url==='/api/data'){s.writeHead(200,{'Content-Type':'application/json'});return s.end('{"del_sitio":true}');}
  if(q.url==='/fuera'){s.writeHead(302,{Location:'https://example.com/'});return s.end();}
  if(q.url==='/dentro'){s.writeHead(302,{Location:'/otra'});return s.end();}
  s.writeHead(200,{'Content-Type':'text/html'});s.end('<html><body><p>sitio hostil</p></body></html>');
}).listen(8171,'127.0.0.1');
EOF
node "$T/hostil.js" & HPID=$!; disown; PIDS="$PIDS $HPID"
mkdir -p "$T/adv"
printf '{ "titulo":"adv","puerto":8172,"producto":{"url":"http://127.0.0.1:8171/"},"puntos":"p","contexto":"./c.md","cola":"./q.jsonl","ia":{"backend":"gemini"} }' > "$T/adv/revlens.config.json"
echo x > "$T/adv/c.md"
REVLENS_CONFIG="$T/adv/revlens.config.json" node "$ENG" >"$T/adv/s.log" 2>&1 & SPID=$!; disown; PIDS="$PIDS $SPID"
sleep 1.2; B=http://127.0.0.1:8172
[ "$(curl -s "$B/api/data")" = '{"del_sitio":true}' ] && ok "GET /api/data llega al SITIO (no al control)" || ko "colisión /api"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$B/_rev/api/comentarios")" = "403" ] && ok "sin X-Revlens → 403" || ko "control abierto sin header"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$B/_rev/api/comentarios" -H 'X-Revlens: 1' -H 'Origin: http://evil.com')" = "403" ] && ok "Origin ajeno → 403" || ko "Origin ajeno pasa"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$B/fuera")" = "502" ] && ok "redirect a OTRO host → 502 (anti-SSRF)" || ko "SSRF: siguió el redirect externo"
curl -s -o /dev/null -w '%{redirect_url}' "$B/dentro" | grep -q "127.0.0.1:8172/otra" && ok "redirect interno → 302 local" || ko "redirect interno mal"
kill $SPID $HPID 2>/dev/null

echo; echo "════════ RESULTADO: $PASS OK · $FAIL FALLOS ════════"
[ "$FAIL" = "0" ] && rm -rf "$T" || echo "restos para inspección en $T"
exit $([ "$FAIL" = "0" ] && echo 0 || echo 1)
