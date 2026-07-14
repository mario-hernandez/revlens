# revlens · Manual para el AGENTE IA

Eres un agente de IA y te han pedido montar **revlens** sobre un producto para que su dueño lo
revise. revlens es una **capa de revisión asistida**: el humano clica un punto del producto, escribe
lo que le inquieta, un **asesor IA que conoce el producto** le sugiere el comentario, y queda anclado
en una cola que TÚ procesarás después. Tu trabajo tiene **dos momentos**: (A) acoplarlo y levantarlo,
(B) cuando el dueño termine, procesar los comentarios.

No hace falta tocar `engine/` (el motor es genérico y estable). Solo creas la **instancia**.

---

## A · Acoplar y levantar (4 pasos)

### 1. Apunta al producto
El producto a revisar debe renderizarse en HTML (web estática, informe HTML, texto maquetado, export
de un doc…). Ten su carpeta localizada. Si el producto es un servidor propio, exporta/renderiza una
copia estática, o añade un `servirTambien` para sus rutas auxiliares.

### 2. Crea `revlens.config.json` (junto a él van el contexto y la cola)
Copia `revlens.config.ejemplo.json` y ajústalo:

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

### 3. Escribe `contexto.md` — LO QUE DECIDE LA CALIDAD DEL ASESOR
Copia `plantillas/contexto.ejemplo.md` y rellena sus **5 capas** (quién es el asesor · qué es el
producto · objetivo real · audiencia · reglas inviolables). Sé concreto: el asesor solo será tan
bueno como este archivo. Aquí es donde el sistema deja de ser genérico y «conoce» el producto.

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
`POST /api/asesor` con `{"mensaje":"prueba"}`.

---

## B · Procesar los comentarios (cuando el dueño termine)

La cola `comentarios-pendientes.jsonl` es append-only, una línea por comentario:
```json
{ "id","ts","estado":"pendiente","seccion":"dónde","ancla":"el fragmento exacto",
  "inquietud":"lo que sintió el humano","texto":"la instrucción a ejecutar","sid" }
```
Para cada comentario `pendiente`: localiza el punto en el producto por `ancla` (búsqueda por
contenido, NO por línea), aplica `texto` respetando las reglas del `contexto.md`, y marca el estado:
`PUT /api/comentario/<id>` con `{"estado":"hecho"}` (o edítalo en disco). Nunca publiques/despliegues
el resultado sin confirmación explícita del dueño.

---

## Invariantes (no los rompas)
- No edites `engine/` para instanciar; todo lo particular va en la config y el contexto.
- La cola tiene backup automático (`.jsonl.bak`) y auto-restauración: **jamás borres la cola** con `rm`.
  Para pruebas usa otro fichero (`"cola": "./_pruebas.jsonl"` o `COMENTARIOS_FILE`), nunca la real.
- Escucha solo en `127.0.0.1` (herramienta local del dueño). Si necesitas exponerla, es decisión del
  dueño y va detrás de su propia autenticación.
- El asesor y los comentarios son **privados del dueño**: no filtres su contenido al exterior.
