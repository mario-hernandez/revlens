# revlens

**Capa de revisión asistida por IA, acoplable a cualquier producto.** La pones encima de una web, un
informe, un guion, un contrato o cualquier texto renderizado en HTML, y su dueño puede: clicar un
punto exacto «como un francotirador», escribir lo que le inquieta, recibir de un **asesor IA que
conoce el producto** un comentario ya redactado, y dejarlo anclado en una cola que **otra IA procesa
después**. Sin cuentas, sin nube, sin dependencias: un servidor local de Node stdlib.

Pensado para ser **montado y operado por un agente de IA**: el agente apunta la config al producto,
rellena un archivo de contexto, lo levanta y —cuando el dueño termina— procesa los comentarios.

## Por qué existe
Revisar un texto con criterio es lento y disperso: la intuición del dueño («esto me chirría») rara vez
se convierte en una instrucción accionable, y menos anclada al punto exacto. revlens cierra ese bucle:
**humano señala e intuye → IA con contexto refina → se guarda anclado → IA ejecuta.** Tres roles claros.

## Cómo funciona (3 piezas)
1. **Contexto** (`contexto.md`) — qué sabe el asesor: quién es, qué es el producto, el objetivo real,
   la audiencia y las reglas inviolables. Es lo único que hace el asesor «experto» en *tu* producto.
2. **Prompt** — cuando el dueño consulta, el sistema envuelve su intuición en una plantilla fija:
   *el punto exacto + su inquietud + un contrato de salida* (`📌 COMENTARIO: …`) que fuerza a la IA a
   posicionarse y emitir una instrucción capturable.
3. **Framework** — anclaje por contenido (no por línea), cola append-only con backup y
   auto-restauración, pins numerados sobre el documento, panel de gestión (ver/editar/borrar,
   autoguardado, a prueba de cierres), y dos salidas: guardar directo o pasar por el asesor.

## Arranque rápido (el ejemplo)
```bash
./abrir.sh          # levanta la demo (landing «Acme») en http://localhost:8140
```
Pulsa **🎯 Comentar un punto**, clica una frase, escribe una inquietud y prueba «Consultar al asesor».

## Acoplarlo a tu producto — lo hace un agente de IA
El flujo, definido en **`AGENTE.md`** (el contrato del agente):
1. El usuario le **entrega** al agente el documento/producto + material de contexto (un repo, un
   directorio, un brief, o info suelta).
2. El agente **genera** con el framework: `revlens.config.json` (a qué apunta, qué es «un punto») y
   `contexto.md` (las 5 capas, **derivadas** del material — no rellenadas a mano).
3. **Levanta** el servidor y da la URL.
4. El usuario **revisa** (clica puntos, comenta con o sin asesor).
5. El agente **procesa** la cola: aplica cada comentario al producto respetando el contexto.

El motor de `engine/` no se toca; todo lo particular vive en la instancia (config + contexto).

## Backend del asesor
`claude -p` por defecto (gratis, comparte la cuota de Claude Code) con **fallback automático a Gemini**
(API propia) si topa el límite. Configurable a solo-claude o solo-gemini. Transporte agnóstico.

## Estructura
```
engine/        motor genérico (server.js + overlay.js) — no se toca para instanciar
plantillas/    contexto.ejemplo.md (las 5 capas a rellenar)
ejemplo/       instancia de demostración (config + contexto + producto)
AGENTE.md      manual para el agente IA: acoplar, levantar y procesar comentarios
revlens.config.ejemplo.json
```

## Privacidad y seguridad
Escucha solo en `127.0.0.1`. El contexto y los comentarios son privados del dueño. La cola nunca se
borra (backup + auto-restauración). Exponerlo en red es decisión del dueño y va tras su propia auth.
