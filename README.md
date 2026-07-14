<div align="center">

# revlens

**English** · [Español](#es)

### Your best advisor, sitting next to you, while you re-read your own work.

An **AI-assisted review and annotation layer** for any live website or document — landing pages,
reports, contracts, scripts. Click the exact point that bugs you, write what you feel, and an AI
advisor that **knows your product** hands it back as a precise, actionable comment — anchored to the
spot, queued for another AI to execute.

<img src="docs/hero.png" alt="revlens reviewing a landing page: highlighted text, AI advisor consultation and anchored comments panel" width="920">

![Node stdlib](https://img.shields.io/badge/Node-pure_stdlib-0b0e16?style=flat-square) ![Zero dependencies](https://img.shields.io/badge/dependencies-0-00b2d6?style=flat-square) ![Local first](https://img.shields.io/badge/privacy-100%25_local-0b0e16?style=flat-square) ![Agent native](https://img.shields.io/badge/mounted_by-AI_agents-00b2d6?style=flat-square)

</div>

---

## That moment

You re-read your landing page, your report, your contract. Something in the pricing paragraph
**feels off** — you sense it, but you can't name it or say what to do about it. Until now, that
ended up as a vague email, a scribbled screenshot, or a *"I'll get to it later"* that never comes.

revlens turns that intuition into finished work:

```
YOU point and sense  →  the ADVISOR who knows your product refines  →  it's ANCHORED  →  another AI EXECUTES
```

Four links, zero friction. Your judgment provides the spark; the system does the rest.

## Watch it happen

<div align="center">
<img src="docs/captura-flujo.png" alt="Full sniper flow: quoted fragment, owner's concern, advisor's verdict and editable suggested comment" width="920">
</div>

A real review, frozen at the good moment *(the demo speaks Spanish — revlens speaks whatever
language your context file speaks)*. Inside the popup, top to bottom:

1. **The exact fragment you clicked**, quoted — here, the landing page's pricing.
2. **Your concern, in your own words**: *"€12 with 'everything included' sounds too good to be true.
   Does it breed distrust?"*
3. **The advisor's verdict** — it shares your concern, explains why, and proposes the way out. It
   knows what your product is, what it's for and how it speaks, because that's written in its context.
4. **The suggested comment, ready to save, editable**: *"Add an anchoring line under the price:
   'less than one hour of your accountant per quarter'. Keeps the €12 and makes it credible."*

One click and it's **anchored with its numbered pin** to the exact spot. Pins ①② on the document
are saved comments; the right-hand panel manages them all.

## The details that make you want it

- **🎯 A true sniper** — you annotate *that* paragraph, *that* sentence. Content-aware anchoring
  survives repeated text, page reloads and pages that change under you.
- **Honest about change** — if the content you annotated changes later, the comment is flagged
  "⚠ detached" and preserved. You get told; your work stays safe.
- **Close-proof** — everything autosaves. Close the browser mid-comment and a
  *"📝 unsaved comment — Recover?"* is waiting when you come back.
- **Your pace, your rules** — save directly without consulting, or go back and forth with the
  advisor until the comment says exactly what you mean.
- **"Copy for the AI"** — one button exports the whole review queue in a format any AI agent
  understands and applies. The loop closes itself.
- **All yours** — runs on your machine (`127.0.0.1`), pure Node, zero dependencies. Your comments
  and your context stay yours; the queue has backup and auto-restore.

## Try it in 10 seconds

```bash
./abrir.sh          # brings up the demo (the «Acme» landing) at http://localhost:8140
```

Press **🎯 Comment a point**, click a sentence, write a concern and try "Consult the advisor".

## Mount it on your product — ask your AI agent

revlens is built to be mounted by an AI agent (Claude Code, etc.) following the **`AGENTE.md`**
contract. You just say *"let's review this"*:

1. You **hand over** the document or URL + some context (a repo, a brief, loose notes).
2. The agent **generates the instance**: `revlens.config.json` (what it points at, what counts as
   "a point") and `contexto.md` — the 5 layers that make the advisor an expert in *your* product:
   who it is, what the product is, the real goal, the audience, and the inviolable rules.
   It **derives** them from your material.
3. It **brings up** the server and gives you the URL.
4. **You review** at your own pace: click, comment, consult.
5. The agent **processes the queue**: applies each comment respecting your context.

**Two product modes, same gesture:**

| Mode | Config | What for |
|---|---|---|
| 🌐 **Live website** | `"producto": { "url": "https://yoursite.com" }` | Same-host live proxy: revlens serves your real site with the layer on. Assets and navigation just work. |
| 📁 **Local folder** | `"producto": { "dir": "./producto" }` | Static HTML, report, export, script — any rendered text. |

The `engine/` core is generic and stable: everything specific lives in the instance (config + context).

## The advisor, under the hood

Every consultation travels wrapped in a fixed template: *the exact point + your concern + an output
contract* (`📌 COMENTARIO: …`) that forces the AI to take a stance and emit a capturable
instruction — opinion with an actionable exit, always. Backend: `claude -p` by default (shares your
Claude Code quota) with automatic fallback to Gemini via API. Transport-agnostic.

## Structure

```
engine/        generic engine (server.js + overlay.js) — never touched to instantiate
plantillas/    contexto.ejemplo.md (the 5 layers to fill)
ejemplo/       demo instance (config + context + product)
docs/          hero + README screenshots
AGENTE.md      manual for the AI agent: mount, bring up, process comments
revlens.config.ejemplo.json
```

## Security

Listens on `127.0.0.1` only. The control plane lives under `/_rev/api/*` behind a custom header +
Origin guard: a web page open in another tab cannot read your comments or burn your advisor quota.
The proxy answers only for the configured host and cuts any redirect pointing elsewhere (anti-SSRF).
Exposing it on a network is the owner's call, behind their own authentication.

---

<a name="es"></a>

<div align="center">

# revlens · Español

[English](#revlens) · **Español**

### Tu mejor asesor, sentado al lado, mientras relees tu propio trabajo.

Clicas el punto exacto que te chirría. Escribes lo que sientes, tal cual te sale.
Un asesor IA que **conoce tu producto** te lo devuelve convertido en una instrucción precisa.
Y otra IA lo aplica después, mientras tú sigues a lo tuyo.

</div>

## Ese momento

Relees tu landing, tu informe, tu propuesta. Algo en el párrafo del precio **te chirría** — lo notas,
pero no sabes decir qué es ni qué hacer con ello. Hasta hoy eso acababa en un email vago, una captura
garabateada o un *«ya lo miraré»* que nunca llega.

revlens convierte esa intuición en trabajo hecho:

```
TÚ señalas e intuyes  →  el ASESOR que conoce tu producto refina  →  queda ANCLADO  →  otra IA lo EJECUTA
```

Cuatro eslabones, cero fricción. Tu criterio pone la chispa; el sistema hace el resto.

## Míralo pasar

Las capturas de arriba son una revisión real, congelada en el instante bueno. Dentro del popup, de
arriba abajo:

1. **El fragmento exacto que clicaste**, citado — aquí, el precio de la landing.
2. **Tu inquietud, en tus palabras**: *«12 € con "todo incluido" me suena demasiado bonito para ser
   verdad. ¿Genera desconfianza?»*
3. **El veredicto del asesor** — comparte tu inquietud, te explica por qué, y propone la salida.
   Sabe de qué va tu producto, cuál es su objetivo y qué voz gasta, porque lo lleva escrito en su contexto.
4. **El comentario listo para guardar, editable**: *«Añadir bajo el precio una línea de anclaje:
   "menos de lo que te cuesta una hora de gestoría al trimestre". Mantiene los 12 € y los hace creíbles.»*

Un clic y queda **anclado con su pin numerado** al punto exacto. Los pins ①② del documento son
comentarios ya guardados; el panel de la derecha los gestiona todos.

## Los detalles que lo hacen querible

- **🎯 Francotirador de verdad** — comentas *ese* párrafo, *esa* frase. El anclaje entiende el
  contenido: sobrevive a texto repetido, a recargas y a páginas que cambian solas.
- **Honestidad ante el cambio** — si el contenido que comentaste cambia después, el comentario se marca
  «⚠ desanclado» y se conserva. Se te avisa; tu trabajo queda a salvo.
- **A prueba de cierres** — todo se autoguarda. Cierras el navegador con un comentario a medias y al
  volver te espera un «📝 comentario a medias — ¿Recuperar?».
- **Tu ritmo, tus reglas** — puedes guardar directo sin consultar, o conversar con el asesor las veces
  que haga falta («Volver a consultar») hasta que el comentario diga exactamente lo que quieres.
- **«Copiar para la IA»** — un botón exporta la cola entera en un formato que cualquier agente entiende
  y aplica. El ciclo se cierra solo.
- **Todo tuyo** — corre en tu máquina (`127.0.0.1`), Node puro, cero dependencias. Tus comentarios y
  tu contexto son tuyos; la cola tiene backup y auto-restauración.

## Pruébalo en 10 segundos

```bash
./abrir.sh          # levanta la demo (landing «Acme») en http://localhost:8140
```

Pulsa **🎯 Comentar un punto**, clica una frase, escribe una inquietud y prueba «Consultar al asesor».

## Acoplarlo a tu producto — se lo pides a tu agente IA

revlens está pensado para que lo monte un agente (Claude Code, etc.) siguiendo el contrato de
**`AGENTE.md`**. Tú solo dices *«revisemos esto»*:

1. Le **entregas** el documento o la URL + algo de contexto (un repo, un brief, info suelta).
2. El agente **genera la instancia**: `revlens.config.json` (a qué apunta, qué es «un punto») y
   `contexto.md` — las 5 capas que hacen al asesor experto en *tu* producto: quién es, qué es el
   producto, el objetivo real, la audiencia y las reglas inviolables. Las **deriva** de tu material.
3. **Levanta** el servidor y te da la URL.
4. **Revisas** a tu aire: clicas, comentas, consultas.
5. El agente **procesa la cola**: aplica cada comentario respetando tu contexto.

**Dos modos de producto, mismo gesto:**

| Modo | Config | Para qué |
|---|---|---|
| 🌐 **Web pública** | `"producto": { "url": "https://tusitio.com" }` | Proxy en vivo same-host: revlens sirve tu web real con la capa puesta. Assets y navegación funcionan solos. |
| 📁 **Carpeta local** | `"producto": { "dir": "./producto" }` | HTML estático, informe, export, guion — cualquier texto renderizado. |

El motor de `engine/` es genérico y estable: todo lo particular vive en la instancia (config + contexto).

## El asesor, por dentro

Cada consulta viaja envuelta en una plantilla fija: *el punto exacto + tu inquietud + un contrato de
salida* (`📌 COMENTARIO: …`) que obliga a la IA a posicionarse y emitir una instrucción capturable —
opinión con salida accionable, siempre. Backend: `claude -p` por defecto (comparte la cuota de Claude
Code) con fallback automático a Gemini por API. Transporte agnóstico.

## Seguridad

Escucha solo en `127.0.0.1`. El plano de control vive en `/_rev/api/*` tras una guardia de header
propio + Origin: una web abierta en otra pestaña no puede leer tus comentarios ni quemar tu cuota del
asesor. El proxy responde únicamente al host configurado y corta cualquier redirect hacia fuera
(anti-SSRF). Exponerlo en red es decisión del dueño y va detrás de su propia autenticación.
