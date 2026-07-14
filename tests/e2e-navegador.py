#!/usr/bin/env python3
"""E2E de revlens en navegador HEADLESS (invisible, siempre): los casos que rompían el núcleo.
B1 anclaje con texto repetido · B2 estado desanclado · B3 DOM dinámico · borrador anti-cierre.
Usa una instancia y cola TEMPORALES (jamás una cola real). Requiere: playwright + Chrome/Chromium.
Uso: python3 tests/e2e-navegador.py
"""
import json, os, shutil, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright

ENG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "engine", "server.js")
T = tempfile.mkdtemp(prefix="revlens-e2e.")
os.makedirs(f"{T}/producto")

# Producto con TEXTO REPETIDO (3 párrafos idénticos) — el caso que rompía el anclaje ingenuo
open(f"{T}/producto/index.html", "w").write("""<!doctype html><html><head><title>Doc B1</title></head><body>
<section><h2>Bloque A</h2><p>El precio del servicio es de 100 euros al mes.</p></section>
<section><h2>Bloque B</h2><p>El precio del servicio es de 100 euros al mes.</p></section>
<section><h2>Bloque C</h2><p>El precio del servicio es de 100 euros al mes.</p></section>
<section><h2>Otro</h2><p>Un parrafo distinto que no se repite.</p></section>
</body></html>""")
open(f"{T}/c.md", "w").write("contexto de prueba")
json.dump({"titulo": "E2E", "puerto": 8175, "producto": {"dir": "./producto", "raiz": "index.html"},
           "puntos": "p,h2", "contexto": "./c.md", "cola": "./q.jsonl", "ia": {"backend": "gemini"}},
          open(f"{T}/revlens.config.json", "w"))

srv = subprocess.Popen(["node", ENG], env={**os.environ, "REVLENS_CONFIG": f"{T}/revlens.config.json"},
                       stdout=open(f"{T}/s.log", "w"), stderr=subprocess.STDOUT)
time.sleep(1.2)
B = "http://127.0.0.1:8175"
P = F = 0
def ok(m):  global P; P += 1; print(f"  ✓ {m}")
def ko(m):  global F; F += 1; print(f"  ✗ {m}")

def lanzar(pw):
    try:
        return pw.chromium.launch(channel="chrome", headless=True)   # Chrome del sistema
    except Exception:
        return pw.chromium.launch(headless=True)                      # Chromium de playwright

try:
    with sync_playwright() as pw:
        br = lanzar(pw)
        pg = br.new_page()
        pg.goto(B, wait_until="networkidle")

        # ── B1: comentar el SEGUNDO de tres párrafos idénticos ──
        pg.click("#rev-aim")
        pg.click("section:nth-of-type(2) p")
        pg.fill("#rev-inq", "Este precio del bloque B me chirría")
        pg.click("#rev-savedirect")
        pg.wait_for_timeout(600)
        pg.reload(wait_until="networkidle")
        pg.wait_for_timeout(800)
        pins = pg.locator(".rev-pin").count()
        en2 = pg.locator("section:nth-of-type(2) p .rev-pin").count()
        en1 = pg.locator("section:nth-of-type(1) p .rev-pin").count()
        (ok if pins == 1 else ko)(f"un solo pin tras recarga (hay {pins})")
        (ok if en2 == 1 and en1 == 0 else ko)(f"B1: pin en el 2º parrafo repetido, no en el 1º (2º={en2}, 1º={en1})")

        pg.click("#rev-open")
        pg.wait_for_timeout(300)
        badge = (pg.text_content("#rev-count") or "").strip()
        (ok if badge.startswith("1") else ko)(f"contador=1 ({badge!r})")
        (ok if pg.locator(".badge-desa").count() == 0 else ko)("sin badge desanclado cuando el punto existe")

        # ── B3: DOM dinámico — borrar un bloque entero; el pin debe re-resolverse ──
        pg.evaluate("document.querySelector('section:nth-of-type(1)').remove()")
        pg.wait_for_timeout(700)  # debounce del MutationObserver
        (ok if pg.locator(".rev-pin").count() == 1 else ko)("B3: pin sigue vivo tras mutar el DOM")

        # ── B2: cambiar el TEXTO comentado → desanclado visible, jamás re-anclar en silencio ──
        pg.evaluate("""document.querySelectorAll('p').forEach(p=>{ if(p.innerText.includes('100 euros')) p.childNodes[0].textContent='Texto totalmente nuevo sin relacion alguna con lo anterior.';})""")
        pg.wait_for_timeout(700)
        (ok if pg.locator(".rev-pin").count() == 0 else ko)("B2: sin pin falso sobre contenido cambiado")
        badge2 = (pg.text_content("#rev-count") or "").strip()
        (ok if "⚠" in badge2 else ko)(f"B2: contador avisa desanclado ({badge2!r})")
        (ok if pg.locator(".badge-desa").count() == 1 else ko)("B2: tarjeta marca 'desanclado' en el panel")

        # ── borrador anti-cierre: escribir sin guardar, recargar, recuperar ──
        pg.reload(wait_until="networkidle"); pg.wait_for_timeout(500)
        pg.click("#rev-aim"); pg.click("section p >> nth=1")
        pg.fill("#rev-inq", "borrador que se perderia")
        pg.wait_for_timeout(200)
        pg.reload(wait_until="networkidle"); pg.wait_for_timeout(500)
        rec = pg.locator("#rev-rec").count()
        (ok if rec == 1 else ko)("borrador ofrecido tras cierre")
        if rec:
            pg.click("#rev-rec"); pg.wait_for_timeout(300)
            val = pg.input_value("#rev-inq")
            (ok if val == "borrador que se perderia" else ko)(f"borrador restaurado ({val!r})")
        br.close()
finally:
    srv.terminate()
    shutil.rmtree(T, ignore_errors=True)

print(f"\n════ E2E navegador: {P} OK · {F} FALLOS ════")
sys.exit(1 if F else 0)
