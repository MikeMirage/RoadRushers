# PRL · mockups de economía local

Propuesta del 2 de noviembre de 2026. Generados con la herramienta integrada Image Gen; no representan pantallas implementadas. Las dos láminas iniciales contienen seis pantallas; la tercera añade tres estados de celebración.

- [Carrera → recompensa → desbloqueo](01-carrera-recompensa-cartas.png): cartera 1.240 → 1.340 CR después de ganar un duelo de entrada 100 y premio bruto 200; cartas de Borough listas para desbloquear. El coche de carrera es Bambino P1, no el Stingray P3.
- [Ligas, torneo y mejora](02-ligas-torneos-mejoras.png): tres ejemplos independientes con cartera inicial 2.400 CR. Acceso a Bosque, inscripción Club Open y mejora Borough N1 → N2.

Las imágenes presentan una composición a escala; la implementación debe mantener controles de 44 px, texto legible y desplazamiento en 390×844. No copiar un texto raster como fuente de verdad: requisitos completos y reglas en [propuesta](../../../docs/economy/ECONOMY_V2_PROPOSAL.md).

Referencias visuales inspeccionadas y adjuntadas a la generación: `../home-2026-11-02/current-home.jpg` y `../garage-studio-2026-11-02/01-garaje-estudio.png`. Se preservan carbón/gris azulado, rosa de acción, azul informativo, miniaturas y estudio de garaje.

Los prompts exactos están en `01-flow.prompt.txt`, `01-flow-correction.prompt.txt` y `02-leagues.prompt.txt`. La corrección del primer tablero armoniza el coche con P1, la cartera antes/después y el progreso previo al desbloqueo. No es una alternativa de estilo.

Para revisión: composición y prioridad de información; claridad del riesgo y del neto; carta objetivo; diferencia entre desbloquear y mejorar. El recorrido Circuito → Reglas → Coche sigue vigente aunque la lámina resuma la entrada a él.

## Revisión: cierres y celebraciones

La [tercera lámina](03-celebraciones.png) añade recompensa con CR hacia cartera, coche desbloqueado y récord personal. Usa la nueva propuesta Events/Career/Drive/Cars/Rankings y cierres visibles. Las dos primeras láminas conservan la barra anterior: no son especificación definitiva de navegación. Reglas completas en [Navegación y celebraciones](../../../docs/economy/NAVIGATION_AND_CELEBRATIONS.md). Prompt exacto: `03-celebraciones.prompt.txt`; herramienta integrada Image Gen.

La tercera lámina traduce visualmente las etiquetas inferiores (Eventos/Carrera/Conducir/Coches/Rankings). La estructura funcional de cinco destinos se mantiene; el idioma final se aplicará de forma consistente. Los títulos atenuados del fondo no definen rutas nuevas.
