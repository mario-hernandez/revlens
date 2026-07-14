# revlens · Manual para el AGENTE IA

Eres un agente de IA y te han pedido montar **revlens** sobre un producto para que su dueño lo
revise. revlens es una **capa de revisión asistida**: el humano clica un punto del producto, escribe
lo que le inquieta, un **asesor IA que conoce el producto** le sugiere el comentario, y queda anclado
en una cola que TÚ procesarás después.

No hace falta tocar `engine/` (el motor es genérico y estable). Tu trabajo es **generar la instancia**
(config + contexto) a partir de lo que te da el usuario, levantarla, y luego procesar la cola.

## El flujo, de principio a fin
```
0. El usuario te ENTREGA: el documento/producto a revisar + material de contexto
   (un repo, un directorio, un brief, o información suelta sobre el proyecto).
1. TÚ (el LLM) LEES ese material y GENERAS con el framework:
      · revlens.config.json   → a qué apunta y qué es «un punto»
      · contexto.md           → las 5 capas, DERIVADAS del material (no las pides rellenas: las escribes tú)
2. LEVANTAS el servidor y le das la URL al usuario.
3. El usuario revisa: clica puntos, deja comentarios (con o sin el asesor).
4. Cuando termina, TÚ PROCESAS la cola: aplicas cada comentario al producto respetando el contexto.
```
El valor está en el paso 1: **conviertes el material bruto del usuario en un asesor que ya conoce su
proyecto.** Cuanto mejor derives el `contexto.md`, mejor asesora el sistema.

---

## A · Generar la instancia y levantar

### 1. Elige el modo de producto
- **Web pública en una URL** → **modo proxy** (lo más habitual): `"producto": { "url": "https://sitio.com" }`.
  revlens sirve la web real en vivo a través de un proxy same-host e inyecta la capa; los assets y la
  navegación entre páginas del sitio funcionan solos (todo lo relativo pasa por el proxy). No copias nada.
  Quita CSP y `<base>` para poder inyectar. Sitios con login o que exijan cabeceras propias: no cubiertos
  por el MVP (usa una copia estática). No es open-proxy: solo reenvía al host de esa URL.
- **Carpeta local** (HTML estático, informe, export) → `"producto": { "dir": "./producto", "raiz": "index.html" }`.

### 2. Genera `revlens.config.json` (junto a él van el contexto y la cola)
Parte de `revlens.config.ejemplo.json` y ajústalo al producto:

```json
{
  "titulo": "REVISIÓN · <nombre del producto>",   // rótulo de la barra
  "puerto": 8130,
  "producto": { "dir": "./producto", "raiz": "index.html" },
  "puntos": "p, li, h1, h2, h3, h4, figcaption, td, blockquote",  // QUÉ es «un punto» comentable
  "contexto": "./contexto.md",
  "cola": "./comentarios-pendientes.jsonl",
  "ia": { "backend": "auto", "claudeModel": "claude-sonnet-5", "geminiModel": "gemini-2.5-flash",
          "geminiKeyEnv": "GOOGLE_GENAI_API_KEY", "geminiKeychain": "gemini-api" }
}
```

- **`puntos`** es la decisión de diseño clave por medio: en una web, bloques y titulares; en un
  texto largo, `p, li, blockquote`; en tarjetas/tabla, añade `.card, td`. Es un selector CSS.
- **`producto.dir`** es relativo a la config. Rutas auxiliares (un visor de PDF, assets externos) →
  `"servirTambien": [{ "prefijo": "/gate/", "dir": "../otro/public" }]`.

### 3. GENERA `contexto.md` — LO QUE DECIDE LA CALIDAD DEL ASESOR
Este es tu trabajo de fondo. NO se lo pides rellenado al usuario: lo **derivas tú** del material que
te entregó (paso 0) — leyendo el producto, el repo, el brief. Parte de `plantillas/contexto.ejemplo.md`
y escribe sus **5 capas** con concreción:
1. **Quién eres** (rol del asesor y a quién sirve) · 2. **Qué es el producto** · 3. **Objetivo real**
(el para-qué, no el qué) · 4. **Audiencia** (quién decide, qué objeción trae cada perfil) · 5. **Reglas
inviolables** (voz, líneas rojas, terminología). Si te falta algo esencial (p. ej. el objetivo de
negocio o la voz de marca) y no lo deduces del material, pregúntaselo al usuario — una o dos preguntas,
no un cuestionario. Aquí el sistema deja de ser genérico y «conoce» el producto.

### 4. Levanta
```bash
REVLENS_CONFIG=/ruta/a/revlens.config.json node engine/server.js
# o, si config y engine están colocados como en /ejemplo:
node ../engine/server.js   # desde la carpeta de la instancia
```
Escucha en `127.0.0.1:<puerto>`. Dale al dueño la URL. El backend `auto` usa `claude -p` (gratis, si
hay Claude Code) y cae a Gemini si topa el límite; si no hay Claude, pon `"backend": "gemini"`.

**Verifica antes de entregar**: `curl localhost:<puerto>/ | grep _rev/overlay.js` (overlay inyectado),
`curl -s localhost:<puerto>/_rev/config` (título/puntos correctos), y una consulta de prueba a
`POST /_rev/api/asesor` con `{"mensaje":"prueba"}` y el header `X-Revlens: 1` (sin él, 403: es la
guardia anti-CSRF del plano de control; todas las rutas `/_rev/api/*` lo exigen).

---

## B · Procesar los comentarios (cuando el dueño termine)

La cola `comentarios-pendientes.jsonl` es append-only, una línea por comentario:
```json
{ "id","ts","estado":"pendiente","seccion":"dónde","ancla":"el fragmento exacto (hasta 800 chars)",
  "selector":"selector CSS estructural del punto","indice":0,
  "inquietud":"lo que sintió el humano","texto":"la instrucción a ejecutar","sid" }
```
Para cada comentario `pendiente`: localiza el punto en el producto — primero por `selector`
(validándolo contra `ancla`), si no por `ancla` + `indice` (índice de ocurrencia cuando el texto se
repite); NUNCA por línea —, aplica `texto` respetando las reglas del `contexto.md`, y marca el estado:
`PUT /_rev/api/comentario/<id>` con `{"estado":"hecho"}` y header `X-Revlens: 1` (o edítalo en disco).
Si el panel marcaba un comentario «⚠ desanclado», el contenido cambió después de comentarlo: resuelve
la intención con el `ancla` guardado y confírmalo con el dueño si hay ambigüedad. Nunca publiques/despliegues
el resultado sin confirmación explícita del dueño.

---

## Invariantes (no los rompas)
- No edites `engine/` para instanciar; todo lo particular va en la config y el contexto.
- La cola tiene backup automático (`.jsonl.bak`) y auto-restauración: **jamás borres la cola** con `rm`.
  Para pruebas usa otro fichero (`"cola": "./_pruebas.jsonl"` o `COMENTARIOS_FILE`), nunca la real.
- Escucha solo en `127.0.0.1` (herramienta local del dueño). Si necesitas exponerla, es decisión del
  dueño y va detrás de su propia autenticación.
- El asesor y los comentarios son **privados del dueño**: no filtres su contenido al exterior.
