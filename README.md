<div align="center">

# revlens

**Capa de revisión asistida por IA, acoplable a cualquier producto.**

Clicas el punto exacto que te chirría · escribes tu inquietud · un asesor IA que *conoce tu producto*
te devuelve el comentario ya redactado · queda anclado en una cola que otra IA ejecuta después.

<img src="docs/hero.png" alt="revlens revisando una landing: punto resaltado, consulta al asesor IA y panel de comentarios anclados" width="920">

*revlens montado sobre una landing real: el dueño clicó el párrafo del precio (resaltado en amarillo),
escribió su inquietud, y el asesor —que conoce el producto— le sugirió el comentario accionable.
Los pins ①② son comentarios ya anclados; el panel de la derecha los gestiona y los exporta a la IA.*

`Node stdlib · cero dependencias · 100 % local (127.0.0.1) · lo monta un agente de IA en minutos`

</div>

---

## El problema que resuelve

Revisar un texto, una web o un informe con criterio es lento y disperso: la intuición del dueño
(*«esto me chirría»*) rara vez se convierte en una instrucción accionable, y menos aún anclada al
punto exacto donde nació. El feedback acaba en emails vagos, capturas anotadas a mano o reuniones.

revlens cierra el bucle completo con tres roles claros:

```
HUMANO señala e intuye  →  ASESOR IA con contexto refina  →  queda ANCLADO  →  otra IA EJECUTA
```

## Cómo se ve por dentro

<div align="center">
<img src="docs/captura-flujo.png" alt="Flujo francotirador completo: fragmento citado, inquietud del dueño, veredicto del asesor y comentario sugerido editable" width="920">
</div>

El **modo francotirador** en acción, de arriba abajo dentro del popup:

1. **El fragmento exacto** que el dueño clicó, citado (aquí, el precio de la landing).
2. **Su inquietud**, en sus palabras: *«12 € con "todo incluido" me suena demasiado bonito para ser verdad. ¿Genera desconfianza?»*
3. **El veredicto del asesor**, que conoce el producto, el objetivo y la voz de marca: comparte la
   inquietud, explica por qué, y propone la salida.
4. **El comentario sugerido, editable**: *«Añadir bajo el precio una línea de anclaje: "menos de lo
   que te cuesta una hora de gestoría al trimestre". Mantiene los 12 € y los hace creíbles.»*
   Un clic y queda guardado, anclado y numerado.

También se puede **guardar directo sin consultar** al asesor, y el botón **«Copiar para la IA»**
exporta toda la cola en un formato que cualquier agente entiende y aplica.

## Las 3 piezas

| Pieza | Qué es | Dónde vive |
|---|---|---|
| **Contexto** | Las 5 capas que hacen al asesor experto en *tu* producto: quién es, qué es el producto, el objetivo real, la audiencia y las reglas inviolables | `contexto.md` (por instancia) |
| **Prompt** | La plantilla fija que envuelve cada consulta: punto exacto + inquietud + contrato de salida (`📌 COMENTARIO:`) que fuerza a la IA a posicionarse y emitir una instrucción capturable | motor |
| **Framework** | Anclaje robusto por contenido (selector estructural + índice de ocurrencia — sobrevive a texto repetido y DOM dinámico), cola append-only con backup y auto-restauración, pins numerados, panel de gestión con autoguardado a prueba de cierres | `engine/` |

## Arranque rápido (la demo)

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

**Dos modos de producto:**

- **Web pública** — `"producto": { "url": "https://tusitio.com" }` → proxy en vivo same-host:
  revlens sirve la web real con la capa inyectada, sin copiar nada; assets y navegación funcionan solos.
- **Carpeta local** — `"producto": { "dir": "./producto" }` → HTML estático, informe, export, guion.

En ambos, el anclaje es por contenido, así que la revisión funciona igual.

## Backend del asesor

`claude -p` por defecto (gratis, comparte la cuota de Claude Code) con **fallback automático a Gemini**
(API propia) si topa el límite. Configurable a solo-claude o solo-gemini. Transporte agnóstico.

## Estructura

```
engine/        motor genérico (server.js + overlay.js) — no se toca para instanciar
plantillas/    contexto.ejemplo.md (las 5 capas a rellenar)
ejemplo/       instancia de demostración (config + contexto + producto)
docs/          hero + capturas del README
AGENTE.md      manual para el agente IA: acoplar, levantar y procesar comentarios
revlens.config.ejemplo.json
```

## Privacidad y seguridad

Escucha solo en `127.0.0.1`. El contexto y los comentarios son privados del dueño. La cola nunca se
borra (backup + auto-restauración). El plano de control vive en `/_rev/api/*` tras una guardia de
header propio + Origin (una web abierta en otra pestaña no puede leer tus comentarios ni quemar tu
cuota del asesor), y el proxy no sigue redirects fuera del host configurado (anti-SSRF). El anclaje
sobrevive a texto repetido y a DOM dinámico; si el contenido comentado cambia, el comentario se marca
«desanclado» en vez de saltar a otro sitio. Exponerlo en red es decisión del dueño y va tras su propia auth.
