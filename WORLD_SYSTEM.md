# RoadRushers · pistas y entornos

## Implementado

La biblioteca tiene **122 módulos** y admite **128 piezas por montaje**. Hay 18 montajes cerrados de prueba, nueve asociados a los entornos solicitados. Los modelos de coche y sus materiales de personalización siguen siendo compatibles.

| Familia | Tipos | Uso |
| --- | ---: | --- |
| Rectas | 11 | Conectores de 4–120 m y rectas originales |
| Curvas | 48 | Radios 12/24/40/64 m; enlaces de 15/30/45/60/90/120/180° |
| Técnicos | 8 | Chicanes, eses y cambios de eje |
| Peraltes | 4 | Apoyos progresivos de 12° y 24° |
| Verticales | 11 | Subidas/bajadas de 2/4/6/12 m y tableros originales |
| Espirales | 16 | Curvas de 90/180/270/360° con desnivel |
| Estructuras | 5 | Puentes, viaductos y túneles |
| Relieve | 5 | Badenes, crestas y lomas |
| Anchuras | 4 | Transiciones a 10/12/14/16 m, relativas a base 10 m |
| Superficies | 10 | Asfalto, grava, tierra, hielo y barro |

La anchura de una transición continúa en las piezas siguientes. Cada módulo puede fijar una superficie compartida por el material, el agarre y los efectos. La posición, altura, dirección y peralte proceden del mismo recorrido para geometría y física. Los conectores son horizontales y sin peralte. Se comprueban cierre, anchura final, pendiente, solapes y gálibo en cruces. La búsqueda espacial evita comparar todos los segmentos al editar circuitos largos.

El botón **Editor** abre el editor manual en tiempo real: trazado, props y entorno comparten la misma escena 3D. Se puede buscar entre los módulos, insertar después de una pieza, duplicar, reflejar, reordenar y editar dimensiones con sliders o medidas numéricas. La cámara conserva el encuadre al editar; hay vistas de circuito completo, selección y cenital. La validación impide probar un trazado sin cierre o con errores.

El editor integra los nueve entornos, control solar por hora o azimut/elevación, clima, precipitación, viento, humedad, nieve, color grading y densidad de hierba. La geometría de la pista, los shaders del bioma y el decorado se actualizan en la vista. Al pulsar **Probar pista**, el juego utiliza los props y ajustes visuales del documento.

Hay **17 tipos de props manuales**, con hasta **256 objetos** por documento: árboles, palmeras, rocas, arbustos, flores, conos, barreras, neumáticos, señales, farolas, tribunas y edificios. Se colocan tocando el terreno o en el centro de la vista y se ajustan con controles 3D o valores numéricos. Admiten giro, escala uniforme, color, duplicación, ajuste a cuadrícula y apoyo en terreno. Se mantienen separados del decorado automático del bioma. **Son decorativos, sin colisiones físicas**; el editor avisa cuando invaden el corredor de conducción.

El historial admite 64 cambios con deshacer y rehacer; cada arrastre es un solo cambio. El documento se guarda localmente en `roadrushers.track-editor.v2`, migra los borradores `roadrushers.track-kit.v1` y se puede exportar/importar como JSON (hasta 1 MB). El guardado es por navegador; exportar permite conservar copias. Atajos: Ctrl/Cmd Z, Ctrl/Cmd Shift Z, Ctrl/Cmd S; G/R/S para transformar un prop seleccionado y Supr para eliminarlo. En móvil, la escena queda arriba y los controles desplazables debajo.

La edición por prompt y la integración de IA quedan aplazadas por decisión del usuario. El formato de documento permite incorporarlas después sin cambiar el sistema de renderizado.

## Nueve direcciones de arte

Son interpretaciones procedurales de miniatura inspiradas en los lugares, con arquitectura y paisajes propios.

| Entorno | Identidad visual | Montaje |
| --- | --- | --- |
| Bosque frondoso | Árboles de varias alturas, dosel, helechos, claros y bruma | Claros del bosque |
| Circuito & hierba | Hierba animada, césped procedural, tribunas, paddock y focos | Parque de competición |
| Dunas & oasis | Dunas deformadas fuera de la carretera, rocas, palmeras y oasis | Vuelta al oasis |
| Invierno noruego | Coníferas nevadas, fiordo, cabañas y sol invernal bajo | Fiordo de invierno |
| Costa amalfitana | Terrazas, fachadas cálidas, muros, acantilados y Mediterráneo | Terrazas de Amalfi |
| Autopistas de Tokio | Viaducto, torres, ventanas iluminadas, neón y señales elevadas | Tokyo Express |
| El Bund · Shanghái | Río, fachadas históricas y una interpretación del skyline | Luces del Bund |
| Puerto de los Pirineos | Roca, cumbres, abetos, aldeas y muros | Puerto de los Pirineos |
| Selva · Isla de Reunión | Dosel tropical, palmeras, helechos, roca volcánica y cascada | Barro de Reunión |

Los montajes temáticos están disponibles en carreras IA. Reunión usa barro y lluvia; Noruega usa nieve. Las condiciones oficiales de la copa se reconstruyen al entrar en sus pruebas.

## Estudio visual

**Entorno** abre entrenamiento con cámara orbital y encuadre del conjunto. Permite ajustar hora solar, latitud, día del año, azimut/elevación manuales, perfil climático, tiempo actual, nubosidad, precipitación, bruma, viento, humedad y nieve. También exposición, contraste, saturación, temperatura de color, tinte, viñeta, densidad de hierba y calidad móvil/equilibrada/alta.

El sol usa hora solar local y una aproximación de declinación anual. Los perfiles climáticos fijan valores base; la temperatura es un dato del perfil y la fase de precipitación se controla con el tiempo seleccionado. Los ajustes se guardan en `roadrushers.environment.v1`; cambiar de entorno conserva el trazado.

Terreno, hierba, agua y cascada usan GLSL propio con tiempo y ruido procedural. La hierba se mueve en el shader y reduce altura a distancia. El terreno recibe variación de color, humedad, nieve y sombras de nubes. El cielo usa el addon Sky instalado. La lluvia tiene trazos y deriva con el viento; la nieve usa partículas suaves. Hay relleno nocturno, faros y luces arquitectónicas agrupadas.

La cadena de imagen es `RenderPass → color grading → OutputPass`. Las reflexiones del cielo se recalculan al confirmar ajustes; las sombras estáticas se invalidan al cambiar el sol. La resolución adaptativa sigue activa. El perfil móvil limita hierba y precipitación y evita recalcular repetidamente sus reflexiones. Queda medir y afinar los presupuestos en dispositivos físicos.

Máximos antes de aplicar densidad y vegetación: 1.200/4.200/8.000 matas de hierba y 320/640/640 partículas. Cada mata usa tres triángulos; los objetos repetidos y luces de edificios usan instancias.

## Fuentes y verificación

- `src/track-library.js`, `src/track-presets.js`, `src/track-pieces.js`: biblioteca, contratos y montajes.
- `src/environment-config.js`: perfiles, normalización y sol.
- `src/environments.js`, `src/environment-themes.js`, `src/biome-shaders.js`: paisaje y shaders.
- `src/environment-system.js`, `src/environment-studio.js`: render y controles.
- `tests/environment-system.test.js`, `tests/track-kit.test.js`: geometría, continuidad, superficies, sol y límites.

Referencias: [Three.js y Shadertoy](https://threejs.org/manual/pages/shadertoy.html), [Sky](https://threejs.org/docs/pages/Sky.html), [ShaderPass](https://threejs.org/docs/pages/ShaderPass.html), [OutputPass](https://threejs.org/docs/pages/OutputPass.html). Los shaders del proyecto son propios y se sirven localmente.
