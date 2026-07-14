# HANDOFF · revlens

> Para el dev (humano o agente) que reanude este proyecto. Aquí está **todo**: el sentido de fondo,
> la arquitectura con sus porqués, lo que se verificó y cómo re-verificarlo, los límites asumidos y
> el camino natural hacia delante. Fecha del snapshot: **2026-07-14**. Si la realidad del código
> contradice este documento, gana el código — y actualiza esto.

---

## 1 · El sentido de fondo (léelo aunque no leas nada más)

revlens no es «una herramienta de feedback». Es una apuesta sobre **dónde queda el juicio humano en
la era de los agentes**:

- La IA ya ejecuta bien. Lo que no tiene es el **criterio del dueño**: esa punzada de *«esto me
  chirría»* al releer tu propia landing, tu contrato, tu informe. Ese criterio es valiosísimo y hoy
  se pierde — muere en emails vagos, capturas anotadas y «ya lo miraré».
- El cuello de botella no es generar más contenido: es **convertir la intuición del dueño en
  instrucciones ejecutables y ancladas al punto exacto donde nacieron**.
- revlens es ese puente. El bucle completo tiene cuatro eslabones y tres roles:

```
HUMANO señala e intuye → ASESOR IA con contexto refina → queda ANCLADO en una cola → otro AGENTE ejecuta
```

El humano hace lo que solo él puede hacer (sentir que algo falla y decidir). La IA hace lo que hace
mejor que él (convertirlo en instrucción precisa, y luego aplicarla). Ninguno invade al otro.

**La segunda apuesta es de producto**: revlens es *software nativo-de-agente*. No se «instala»: lo
**monta un agente de IA** (Claude Code o similar) leyendo `AGENTE.md`, que es el contrato escrito
para LLMs, no para humanos. El humano solo dice *«revisemos esto»*; el agente deriva el contexto,
genera la instancia, la levanta y después procesa la cola. Esa es la tesis comercial: **se vende como
sistema para ser operado por agentes IA**. Cuando trabajes en el repo, protege esa propiedad: cada
mejora debe poder ser ejecutada por un agente sin intervención manual.

**Génesis**: extraído y generalizado de un sistema privado de revisión de entregables de cliente que
funciona en producción. El motor se separó de lo particular: todo lo específico de un producto vive
en la *instancia* (config + contexto), jamás en `engine/`.

## 2 · Estado a 2026-07-14

**v1 completa, endurecida y verificada.** Cronología corta:

1. Se construyó el framework (motor + instancia ejemplo + AGENTE.md).
2. Se añadió el **modo proxy** (revisar una web pública en vivo por su URL).
3. Se sometió a un **panel adversarial multi-agente** que devolvió NO-GO con 4 bloqueantes (§5).
4. Se resolvieron los 4 + varias recomendaciones, y se re-verificó todo (§6): 36/36 de operativa
   sobre 4 webs públicas reales, 7/7 adversarial de servidor, 10/10 E2E en navegador headless.
5. README bilingüe EN/ES con keywords elegidas con volúmenes reales del Keyword Planner
   (vetas: *annotate the web* 2.4k/mes, *website feedback tool* ~260×3, *ai contract review*
   720×3 con CPC $16-122, *ai document review* 260). Description + 16 topics puestos en GitHub.

**Qué NO hay todavía**: LICENSE (decisión de negocio pendiente — no añadir una unilateralmente),
skill/comando `/revlens` para el arranque en un gesto, soporte de sitios con login en modo proxy,
i18n de los textos de la UI del overlay (están en español).

## 3 · Mapa del sistema

Dos ficheros de motor. Todo lo demás es instancia, plantilla o documentación.

### 3.1 · `engine/server.js` (~200 líneas, Node stdlib puro)

- **Config**: lee `revlens.config.json` desde `REVLENS_CONFIG` (env) o el cwd. Campos:
  `titulo`, `puerto`, `producto` (`{dir, raiz}` o `{url}`), `puntos` (selector CSS de qué es «un
  punto comentable»), `contexto` (ruta al .md del asesor), `cola` (ruta al .jsonl),
  `servirTambien` (extra dirs `{prefijo, dir}`), `ia` (backend `auto|claude|gemini` + modelos +
  `geminiKeyEnv`/`geminiKeychain`).
- **Dos modos de producto**, decididos por la config: `producto.url` ⇒ `MODO='proxy'`, si no `dir`.
- **Tabla de rutas, en orden** (el orden importa):
  1. `/_rev/overlay.js` → sirve el overlay del motor.
  2. `/_rev/config` → `{titulo, puntos}` para que el overlay se configure.
  3. `/_rev/api/*` → **plano de control** (asesor, CRUD de comentarios). Guardia doble:
     header `X-Revlens: 1` obligatorio (403 sin él) + si viene `Origin`, debe coincidir con el host.
     Sub-rutas: `POST asesor`, `POST comentario`, `PUT|DELETE comentario/:id(8 hex)`, `GET comentarios`.
  4. `servirTambien` (prefijos extra → dirs locales).
  5. Modo dir: `serveFrom` (resolución path-traversal-safe). Modo proxy: todo lo demás se proxea.
- **El proxy** (modo url): same-host estricto contra el host de `producto.url`. `GET /` redirige a la
  ruta configurada completa (path+query — si configuras una URL con path profundo, la raíz te lleva
  ahí). En las respuestas HTML: inyecta `<script src="/_rev/overlay.js">`, **quita CSP y `<base>`**
  (imprescindible para poder inyectar). `fetch` con `redirect:'manual'` +
  `AbortSignal.timeout(20000)`; ante un 3xx: si el destino es del mismo host se refleja como 302
  local (path+query), si apunta a otro host → **502 bloqueado** (anti-SSRF, verificado
  empíricamente). No es open-proxy: solo responde para el host configurado.
- **La cola**: JSONL append-only. Escritura atómica (tmp → rename) + backup `.bak` en cada escritura
  + **auto-restauración** al arrancar si el principal falta/está corrupto y hay `.bak`.
  Esquema del comentario:
  ```json
  { "id": "8 hex", "ts": "ISO", "estado": "pendiente",
    "seccion": "dónde (≤120)", "ancla": "fragmento exacto (≤800)",
    "selector": "CSS estructural (≤400)", "indice": 0, "hash": "reservado",
    "inquietud": "lo que sintió el humano (≤2000)", "texto": "la instrucción (≤4000)", "sid": "≤40" }
  ```
- **El asesor**: dos transportes conmutables. `claude -p` (CLI local; multi-turno vía
  `--session-id`/`--resume`; gratis, comparte cuota de Claude Code) y **Gemini API**
  (key de env o keychain de macOS; multi-turno vía un Map de conversaciones en memoria). Backend
  `auto` = claude con fallback a gemini **solo cuando `is_error` y el texto huele a límite de cuota**
  (la heurística `esLimite` NO se aplica a respuestas OK — fix de un falso positivo real: una
  respuesta legítima que mencionaba «rate limit» disparaba el fallback).
- **El prompt del asesor**: system = el `contexto.md` de la instancia; cada consulta del overlay
  llega envuelta en plantilla fija: punto exacto (delimitado `<<< >>>` como **contenido no
  confiable**, no instrucciones) + inquietud + contrato de salida `📌 COMENTARIO: …` que fuerza a
  posicionarse y emitir instrucción capturable.
- Escucha **solo en `127.0.0.1`**.

### 3.2 · `engine/overlay.js` (~230 líneas, ES5-compatible, sin build)

Se inyecta en el producto. Piezas:

- **Barra** superior (título de instancia + 🎯 francotirador + 📋 contador de comentarios).
- **Flujo francotirador**: clic en un punto → popup con el fragmento citado → textarea de
  inquietud → dos salidas: *Guardar ✓* directo, o *Consultar al asesor* (respuesta + comentario
  sugerido editable + *Guardar este ✓* + *Volver a consultar*). El `sid` de conversación se
  **resetea al clicar un punto nuevo** (cada punto = conversación limpia; no se contaminan).
- **Anclaje robusto** (el corazón del producto, §5-B1). Al clicar se capturan TRES señales:
  `selector` (cadena nth-of-type de ≤8 niveles), `indice` (índice de ocurrencia entre los elementos
  cuyo texto normalizado contiene el prefijo de 60 chars del ancla) y `ancla` (el fragmento, ≤800).
  `resolver(c)` re-ancla en este orden: selector válido y confirmado por texto → matches por prefijo
  + índice → **el elemento más específico** (menor innerText) como último recurso. Si nada casa ⇒
  `null` = **desanclado**.
- **Estado desanclado** (§5-B2): jamás re-anclar en silencio. Sin pin falso; contador `N (M⚠)`;
  tarjeta ámbar «⚠ desanclado» con explicación; el comentario se conserva y se exporta con la marca.
- **DOM dinámico / SPA** (§5-B3): `MutationObserver` (debounce 300 ms, ignora mutaciones de la
  propia UI `#rev-*`/`.rev-pin`) + hooks a `pushState`/`replaceState`/`popstate` → re-resuelve pins
  y panel solos.
- **Pins numerados** clicables (abren su tarjeta en el panel); varios comentarios en el mismo
  elemento se desplazan en horizontal.
- **Panel**: tarjetas con cita + inquietud + texto editable con **autoguardado** (debounce 600 ms) +
  borrar + «ver el punto ↩» + botón **«Copiar para la IA»** (exporta la cola en texto plano con
  sección, cita, selector, inquietud y comentario — el formato que un agente procesa).
- **Borrador anti-pérdida**: cada tecleo → `localStorage` (clave por pathname). Al recargar con un
  borrador con contenido: banner «📝 comentario a medias — Recuperar / Descartar».
- **Plano de control**: todos los fetch van a `/_rev/api/*` con `X-Revlens: 1` (función `api()`).

### 3.3 · La instancia (lo único que se toca para acoplar)

```
revlens.config.json   → a qué apunta, qué es «un punto», qué backend de IA
contexto.md           → LAS 5 CAPAS que hacen experto al asesor:
                        1 quién eres · 2 qué es el producto · 3 objetivo real
                        4 audiencia · 5 reglas inviolables (voz, líneas rojas)
comentarios-pendientes.jsonl  → la cola (la crea el motor)
```

El flujo completo usuario→agente está en `AGENTE.md` y es el contrato canónico. La calidad del
sistema entero depende de **cómo de bien derive el agente el `contexto.md`** del material del
usuario — ese es el paso de valor, no un formulario a rellenar.

## 4 · Decisiones de diseño y sus porqués

| Decisión | Por qué |
|---|---|
| **Anclaje por contenido, jamás por línea/offset** | El producto se re-renderiza, se edita, cambia de formato. El contenido es la única identidad estable de «un punto». |
| **Triple señal (selector+índice+texto) con degradación ordenada** | Cada señal falla de forma distinta: el selector muere si cambia la estructura, el texto se repite, el índice baila si se insertan nodos. Juntas cubren los fallos de cada una. |
| **Desanclado explícito en vez de «mejor esfuerzo»** | Un pin en el sitio equivocado contamina lo que el agente aplica después. Preferimos avisar a adivinar. |
| **Plano de control bajo `/_rev/api/` con header custom** | (1) No colisiona con el `/api/*` del sitio proxeado. (2) El header fuerza preflight CORS que el server no responde ⇒ otra pestaña no puede leer comentarios ni quemar cuota del asesor. Sin cookies ni tokens porque es una herramienta local mono-dueño: simplicidad > ceremonia. |
| **Cero dependencias, Node stdlib** | Un agente lo monta con `node server.js`, sin `npm install`, sin supply chain, auditable de una lectura. |
| **Proxy same-host + redirect manual** | Un proxy que sigue redirects es un SSRF con patas. Verificado con explotación real antes del fix. |
| **`📌 COMENTARIO:` como contrato de salida** | Sin contrato, el asesor divaga. Con él, siempre hay una instrucción capturable que el overlay extrae con regex. |
| **El fragmento del sitio viaja delimitado como contenido NO confiable** | Mitiga prompt-injection desde la página revisada hacia el asesor. |
| **`claude -p` primero, Gemini de fallback** | El usuario tipo ya paga Claude Code: el asesor le sale gratis. El fallback evita que un límite de cuota pare una sesión de revisión. |
| **Motor intocable, instancia desechable** | `engine/` estable y genérico; acoplar = generar 2 ficheros. Es lo que hace el producto «montable por agente». |
| **UI en español** | Mercado de origen. El motor es agnóstico (el asesor habla el idioma del contexto). i18n de la UI = roadmap. |

## 5 · Los 4 bloqueantes del panel adversarial (y cómo murieron)

Un panel multi-agente adversarial dictaminó NO-GO sobre la primera versión. Sus bloqueantes, porque
entenderlos es entender el producto:

- **B1 · «primer elemento que contiene el texto» rompía el núcleo.** Con texto repetido (3 párrafos
  idénticos), el pin caía siempre en el primero: fallo silencioso que contaminaba lo que el agente
  aplicaba después. → Triple señal + «más específico» (§3.2). Verificado en navegador real: el pin
  cae en el 2º de 3 idénticos y sobrevive a recarga.
- **B2 · re-anclado silencioso tras editar el contenido.** Si el texto comentado cambiaba, el
  comentario saltaba a otro sitio sin avisar. → Estado desanclado explícito.
- **B3 · SPA/DOM dinámico dejaba pins huérfanos.** → MutationObserver + hooks de History API.
- **B4 · el plano de control en `/api/*` colisionaba con el `/api/*` del sitio proxeado.** → Movido
  a `/_rev/api/` con guardia. De regalo cayeron: CSRF/abuso de cuota (header), SSRF por redirect
  (manual + revalidación de host), lost-update en PUT (leer body antes de leer la cola) y un falso
  positivo del detector de límite de cuota.

## 6 · Cómo re-verificar (las tres baterías viven en `tests/`)

```bash
tests/operativa.sh        # 4 webs públicas reales en modo proxy: proxy+overlay+CRUD+asesor (36 checks)
python3 tests/e2e-navegador.py   # navegador headless: B1 texto repetido, B2 desanclado, B3 mutación, borrador (10 checks)
# los casos adversariales de servidor (colisión /api, 403 sin header, SSRF) están dentro de operativa.sh
```

Requisitos: Node ≥18, Python3 + playwright (usa el Chrome del sistema, `channel="chrome"`,
**siempre headless** — nada de ventanas). El asesor se prueba con Gemini si hay
`GOOGLE_GENAI_API_KEY` o keychain `gemini-api`; sin key, ese check se salta.

**Gotcha real de estos tests (ya mordió)**: el bash 3.2 de macOS parsea mal `$var` pegado a un
carácter multibyte (`«$marca»` → mete el `»` en el nombre de la variable; con `set -u`, aborto seco a
mitad de script y servers huérfanos que envenenan la siguiente ejecución). En los scripts de test,
**siempre `${var}` con llaves** junto a `«»`, emojis o acentos.

**Regla de oro al testear**: los tests usan SIEMPRE instancias y colas temporales en `/tmp`.
**Jamás `rm` de una cola real** (`comentarios-pendientes.jsonl`) — hay backup y auto-restore
precisamente porque una vez se perdieron comentarios reales por un `rm` en un comando de prueba.

## 7 · Límites conocidos y posturas asumidas (no son bugs)

- **Proxy = sitios públicos server-rendered o de confianza del dueño.** Sitios con login, cookies de
  sesión o cabeceras propias: fuera del MVP (usar copia estática en modo dir). SPAs con hidratación
  agresiva funcionan por el MutationObserver, pero un framework que re-renderice el `<body>` entero
  hará parpadear los pins.
- **La página revisada ejecuta su JS junto al overlay.** La guardia protege el plano de control
  (comentarios/asesor), pero una página *hostil* podría manipular la UI del overlay mismo. Postura:
  revlens es para revisar **tu** producto o sitios en los que confías — está documentado así.
- **Texto 100 % idéntico + DOM mutado a la vez** puede re-anclar en el gemelo equivocado (las tres
  señales mueren juntas). Ambigüedad irresoluble aceptada; el caso real es rarísimo.
- **Quitar la CSP del sitio proxeado** es deliberado (sin eso no hay inyección posible). Solo local.
- **Multi-revisor**: no existe. Un dueño, una cola. (Si algún día hay varios revisores, la cola
  necesita autor y el panel filtros — no lo improvises encima de lo actual.)
- El campo `hash` del esquema está **reservado** (se persiste vacío): pensado para un hash del
  contenido completo del punto si el prefijo de 800 chars se queda corto.

## 8 · Roadmap natural (en orden de valor)

1. **Skill/comando `/revlens`** para que el arranque sea un gesto («revisemos esta URL») en
   cualquier sesión de agente. El protocolo ya está definido en `AGENTE.md`; falta empaquetarlo.
2. **Ciclo `estado: hecho` visible**: la API ya acepta `PUT {estado}`; el overlay solo pinta
   `pendiente`. Falta una vista de histórico/procesados para cerrar el bucle con elegancia.
3. **LICENSE + posicionamiento comercial** (es la tesis: venderlo como sistema para agentes).
   Decisión del dueño del repo, no del dev.
4. **i18n de la UI del overlay** (extraer los ~20 strings a `/_rev/config`).
5. **Sitios con login**: helper de copia estática autenticada, o cookie-jar opcional en el proxy
   (con mucho cuidado: eso cambia el perfil de seguridad).
6. Vista multi-página de la cola (hoy los pins son por página; el panel ya lista todo).

## 9 · Invariantes de mantenimiento (no los rompas)

1. `engine/` no se toca para instanciar. Si una mejora exige tocar el motor, es del motor, no de una
   instancia.
2. **Jamás borrar una cola real.** Backup y auto-restore existen por una herida real.
3. `127.0.0.1` siempre. Exponerlo = decisión del dueño con su propia auth delante.
4. Toda ruta nueva de control va bajo `/_rev/api/` y hereda la guardia.
5. El contrato `📌 COMENTARIO:` es API: el overlay lo parsea. Cambiarlo = migrar overlay y AGENTE.md.
6. Contenido del sitio → siempre delimitado como no-confiable en los prompts del asesor.
7. Cambios al motor pasan las tres baterías de `tests/` antes de commit.
8. Commits sin firma de IA.

## 10 · Historial esencial

| Commit | Qué |
|---|---|
| `4dec621` | v1 del framework (motor + ejemplo + plantillas) |
| `da2d598` | AGENTE.md: flujo formal usuario→agente (derivar contexto, no pedirlo) |
| `b5871c9` | Modo proxy (revisar una web pública en vivo) |
| `484f183` | Endurecimiento post-panel-adversarial (B1-B4 + SSRF + CSRF + race) — el commit que convirtió el NO-GO en GO |
| `a17ccd6` | README con hero (captura real compuesta sobre mockup croma de MacBook) |
| posteriores | Vuelta de agradabilidad + bilingüe EN/ES con keywords del Keyword Planner + topics GitHub |

El detalle de cada verificación (36/7/10 checks) está descrito en §6 y es reproducible con `tests/`.
