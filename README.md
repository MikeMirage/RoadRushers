# RoadRushers · prototipo 02

Carreras 3D con aceleración automática y solo dos controles de dirección. Esta versión añade una primera carrera con medallas, desbloqueos y una colección de coches en 3D, partiendo de [Starter Kit Racing de mrdoob](https://github.com/mrdoob/Starter-Kit-Racing).

**[Jugar en GitHub Pages](https://mikemirage.github.io/RoadRushers/)** · [Repositorio](https://github.com/MikeMirage/RoadRushers)

## Fase actual: pruebas de gameplay

La entrada del juego es un configurador libre: los 53 coches, todos los circuitos, superficie, clima, entorno, anchura, ritmo, cámara y carreras IA están disponibles desde el principio. Las copas y la progresión quedan fuera de este flujo. Ver [modo de pruebas y controles móviles](PLAYGROUND.md).

## Ejecutar

### Jugar desde el móvil

Abre **[Pocket Racing League](https://mikemirage.github.io/RoadRushers/)** en Safari (iPhone/iPad) o Chrome (Android). No necesitas instalar Node.js en el teléfono ni mantener el ordenador encendido para jugar a la versión publicada.

Para probar los cambios locales antes de publicarlos:

1. Conecta el móvil y el ordenador al mismo Wi-Fi.
2. En el Mac, abre **`Jugar en movil.command`** con doble clic.
3. Abre en el navegador del teléfono la dirección que aparece en Terminal bajo **Móvil** (por ejemplo, `http://192.168.1.25:5174/`). Deja Terminal abierto mientras juegas.

También puedes usar `npm run dev:mobile` o `./"Jugar RoadRushers.command" --mobile`. Si el lanzador cambia de puerto, usa la dirección exacta que muestra. Si no conecta, comprueba que ambos dispositivos comparten red, que no es una red de invitados con aislamiento y que el firewall permite la conexión a Node.js.

El coche acelera solo: toca la mitad inferior izquierda o derecha para girar y ambas a la vez para frenar. En **Opciones → Controles** puedes elegir el trackpad analógico. El juego admite vertical y horizontal; los tiempos y ajustes se guardan en el navegador de cada dispositivo.

### Ejecutar en el ordenador

En macOS puedes hacer doble clic en los lanzadores de la carpeta principal:

- **`Jugar RoadRushers.command`** abre en el navegador el código actual de esta carpeta, incluidos los cambios locales. Prepara las dependencias automáticamente; requiere Node.js (recomendado: 24 LTS) e Internet la primera vez. Deja la ventana de Terminal abierta mientras juegas y pulsa `Ctrl+C` para detenerlo. Si el puerto habitual está ocupado, utiliza otro disponible.
- **`Descargar versiones.command`** consulta GitHub y permite elegir la última versión de `main`, una etiqueta o una revisión anterior por fecha y descripción. También acepta una rama, etiqueta o SHA escrito a mano. Guarda cada copia en `versiones/RoadRushers-fecha-SHA/`, con un registro `VERSION-DESCARGADA.json`. Al abrir el launcher desde una copia descargada, se redirige al juego actual de la carpeta principal, incluidos los cambios locales.

La descarga conserva el código y los recursos de esa revisión para consultarlos. Las dependencias del juego actual se preparan al abrir el launcher principal. Para descargar directamente desde Terminal: `./"Descargar versiones.command" --ref main` (también admite etiquetas o SHA).

También puedes ejecutarlo manualmente:

```sh
npm ci
npm run dev
```

Abrir `http://127.0.0.1:5174/` en un navegador con WebGL. Los modelos, el humo y las tipografías se sirven localmente; no requiere claves ni servicios externos.

```sh
npm test          # Conducción, vueltas, cámaras y progresión
npm run build    # Compilar a dist/
npm run preview  # Probar la compilación
npm run preview:mobile # Probar dist/ desde otro dispositivo del mismo Wi-Fi
```

## Publicación en GitHub Pages

El workflow `.github/workflows/pages.yml` instala las dependencias, ejecuta los tests, compila y publica cada actualización de `main`. Se puede lanzar también desde Actions. GitHub Pages utiliza la fuente **GitHub Actions**. La compilación recibe la ruta base de Pages, para que funcionen los modelos, fuentes y enlaces dentro del subdirectorio del repositorio.

Para comprobar esa ruta localmente:

```sh
npm run build -- --base /RoadRushers/
npm run preview -- --base /RoadRushers/
# Abrir http://127.0.0.1:4174/RoadRushers/
```

## Carrera IA

**Carrera IA** en la pantalla principal abre la configuración de una parrilla de 4, 8 o 12 coches, con 1, 3 o 5 vueltas. Puedes comparar **Ghosts** y **Con contacto**, y anchuras base original, 12, 14 o 16 m cuando el trazado lo permite. El coche se elige en el garaje. Los rivales locales usan esa misma clase, con distintos ritmos, colores, apodos y trazadas.

La dificultad se elige entre **Novato, Club y Experto**, con parrilla variada o uniforme. Todos usan los parámetros físicos del jugador; el nivel cambia sus decisiones de conducción, adelantamiento y defensa.

Posición en directo, parrilla escalonada, minimapa con rivales y resultado al llegar a meta. La IA conduce con la física y el freno del juego, respeta los dos niveles de los puentes y puede buscar huecos o frenar en modo contacto. Ver [reglas y funcionamiento de la carrera](RACE_MODE.md).

## Kit modular de circuitos

Abrir **Tramos** para montar **122 tipos de piezas**: rectas métricas, curvas de varios radios y ángulos, chicanes, cambios de eje, peraltes, rampas, espirales, puentes, túneles, lomas y transiciones de anchura/superficie. Admite 128 piezas, búsqueda, inserción, duplicado, reflejo, reordenación, edición de medidas, deshacer y borradores locales.

Incluye **18 montajes cerrados**, desde Club técnico y Ocho elevado hasta Tokyo Express, Fiordo de invierno, Barro de Reunión y Espirales gemelas. La altura, el peralte, la anchura y las superficies se comparten entre render y física. Ver [el sistema ampliado de pistas y entornos](WORLD_SYSTEM.md) y [las reglas del kit original](TRACK_KIT.md).

## Entornos y dirección de arte

**Entorno** abre una vista previa con cámara orbital. Hay nueve presets: bosque frondoso, circuito con hierba, dunas y oasis, invierno noruego, costa amalfitana, autopistas de Tokio, Bund de Shanghái, Pirineos y selva de Reunión. Se puede ajustar hora solar, azimut/elevación del sol, clima, nubes, niebla, precipitación, viento, humedad, nieve y color grading. Terreno, hierba, agua y cascadas tienen shaders procedurales; las ciudades tienen luces nocturnas y los coches, faros.

Los mismos presets se eligen al probar un montaje y en sus carreras IA. El estudio tiene panel lateral en escritorio y hoja inferior en móvil. Ver [implementación y presupuestos gráficos](WORLD_SYSTEM.md). La siguiente fase de meta y navegación móvil se propone en [dirección de juego](GAME_DIRECTION.md), con Golf Clash y Gran Turismo como referencias.

## Copa de Iniciación (implementación reservada)

Este sistema se conserva para una fase posterior y no limita el modo de pruebas actual.

Cada prueba es una vuelta con coche, materiales, clima y ritmo oficiales. Un bronce abre la siguiente prueba. Los mejores resultados se conservan y pueden mejorarse sin perder medallas.

| Prueba | Coche | Oro | Plata | Bronce |
| --- | --- | --- | --- | --- |
| Curvas del Puerto | Truck Classic | 31 s | 41 s | 62 s |
| Lazos del Aserradero | Evo Rally | 34 s | 45 s | 68 s |
| Horquillas del Faro | Evo Rally | 39 s | 52 s | 78 s |

Bronce vale 1 punto, plata 2 y oro 3. Completando las tres pruebas, la copa es de bronce con 3 puntos, plata con 6 y oro con 8. El primer bronce desbloquea el Evo Rally; completar las tres pruebas desbloquea el Cobra 427. El guardado es local al navegador y dispositivo. Si el almacenamiento no está disponible, se puede progresar durante la sesión.

Ocho controles ordenados validan cada vuelta y rechazan el sentido contrario y los saltos de recorrido. El entrenamiento usa récords independientes por circuito, coche, superficie, clima y ritmo, y no concede recompensas de campeonato.

En individual compites automáticamente contra el **fantasma de tu mejor vuelta**: una copia cian semitransparente de tu coche, sin colisiones y con dos estelas cortas que se desvanecen. La primera vuelta completa crea la referencia; solo una vuelta más rápida la sustituye. Se guarda al cruzar meta y se recupera al volver a jugar en el mismo navegador. El fantasma sigue el cronómetro de cada vuelta, incluidas pausas, reinicios, saltos, altura y peralte. Las carreras IA también conservan la trazada de su mejor vuelta, en su propia categoría; el fantasma personal se muestra en individual. Si el navegador impide guardar, se mantiene durante la sesión y se indica al completar la vuelta. Los récords antiguos que solo contienen tiempos necesitan una nueva vuelta completa para crear su trazada.

## Garaje: una colección de miniaturas

La vitrina reúne **53 modelos**: la serie original y **50 nuevas miniaturas en cinco tandas de 10**. Cada pestaña carga solo su tanda. Selecciona un coche o su ficha para ampliarlo, arrastra para girar y usa la rueda o pellizca para acercar. Los 50 diseños de taller están disponibles en entrenamiento; los tres originales conservan los desbloqueos de la copa.

- **Truck Classic:** el truck amarillo original de Kenney, dócil y fácil de recuperar.
- **Evo Rally:** sedán rojo inspirado en el Mitsubishi Lancer Evolution, con alerón, capó ventilado y mayor estabilidad sobre terreno suelto.
- **Cobra 427:** roadster azul inspirado en el Shelby Cobra, con capó largo, franjas blancas, cabina abierta y un comportamiento más rápido y deslizante.

Los 50 nuevos modelos permiten cambiar pintura, segundo color, wrapping, neumáticos, estilo y color de llantas, y tinte/opacidad de lunas desde el detalle. Los ajustes se guardan por coche. También se puede cargar una textura UV PNG/JPG/WEBP durante la sesión. Todos tienen frenos funcionales y anclajes para futuros trails; las marcas de derrape usan su anchura y batalla reales. El garaje detiene el render de la pista mientras está abierto. La personalización de la serie original queda pendiente de adaptación.

Las cinco tandas son **Clásicos europeos**, **Muscle & hot rods**, **Japón & rally**, **Deportivos & supercoches** y **Aventura & especiales**. Ver [los 50 modelos y el contrato de piezas/materiales](VEHICLE_COLLECTION.md). Cada ficha tiene proporciones y detalles propios, sin insignias de fabricante.

```sh
npm run models:qa      # Geometría, UV, pivotes, presupuesto y anclajes de los 50
npm run models:export  # Regenerar 50 GLB y manifest.json
```

Los GLB independientes están en `public/models/collection/` y se descargan también desde la ficha de cada coche. La fuente editable es `src/vehicle-catalog.js` + `src/vehicle-modeler.js`. Abrir `http://127.0.0.1:5174/vehicle-review.html` para ver dos ángulos por modelo, revisar en arcilla/malla y descargar las cinco láminas PNG. Esta vista también se incluye en la compilación.

## Circuitos y biomas

- **Curvas del Puerto:** chicane, curvas enlazadas y tramo de grava, entre casas mediterráneas, palmeras, muelles y barcos.
- **Lazos del Aserradero:** bosque de pinos y frondosas, río con puentes, aserradero y pilas de madera. Combina asfalto, grava y tierra.
- **Horquillas del Faro:** dos horquillas, estrechamientos y salida técnica, en la costa al atardecer con faro y costa de arena.

Los tres circuitos tienen anchuras variables y curvas suavizadas. El mismo recorrido genera la pista visible, sus materiales, las colisiones, el minimapa y el cronometraje. En entrenamiento, **Circuito** permite cambiar el trazado, aplicar sus sectores originales o fijar asfalto, tierra, grava o hielo; probar despejado, lluvia, niebla, nieve y atardecer; y variar el ritmo entre Paseo, Ágil y A fondo.

## Controles y conducción

| Control | Acción |
| --- | --- |
| ← / → o A / D | Girar respecto al coche |
| ← + → o A + D, mantenidos | Frenar progresivamente |
| Enter / Comenzar prueba | Iniciar con cuenta atrás |
| C | Cámara aérea / tercera persona amplia |
| Espacio / Escape | Pausa / continuar; Escape cierra el garaje |
| R | Reiniciar la vuelta |
| Mitad inferior izquierda / derecha de la pantalla | Girar; tocar las dos zonas a la vez para frenar |

El coche acelera solo. Mantener izquierda y derecha a la vez corta el acelerador y aumenta suavemente la presión del freno hasta detenerlo si se mantiene. Soltar una dirección libera el freno, vuelve a acelerar y permite entrar en la curva con esa dirección. El agarre de la superficie y el clima afectan a la distancia de frenado. Los tres coches encienden sus pilotos traseros rojos al frenar y proyectan un halo rojo sobre la carretera mediante un degradado, sin luces dinámicas; sigue la altura y el peralte del tramo. Entra con velocidad y mantén el giro para derrapar; suelta o aplica contravolante para recuperar la trayectoria. Humo y marcas representan el deslizamiento real. Superficie, clima y perfil del coche modifican el agarre y la velocidad. Los guardarraíles contienen el coche sin rebotes repetidos. Al cambiar de pestaña se pausa y libera los controles.

La cámara aérea es alta, alejada y de orientación fija, con margen para ver el coche deslizar dentro del encuadre. La tercera persona sigue la dirección del movimiento con más distancia. Física a 120 Hz, poses interpoladas, sombras estáticas, paisaje agrupado y resolución adaptativa mantienen las mejoras de estabilidad del prototipo anterior; grava y tierra no añaden vibración artificial.

`http://127.0.0.1:5174/?stats=1` muestra FPS, tiempo de render, llamadas de dibujo y resolución. Solo aparece al solicitarlo en la URL. Esta versión tiene progresión y récords locales; la economía, torneos online y ELO quedan para una siguiente fase.

## Editor manual de pistas

Abre **Editor** en la barra superior. Combina 122 módulos de pista, 17 tipos de props y nueve entornos en una escena 3D con controles en tiempo real. Puedes ajustar el sol, el clima y el color, colocar decorado, deshacer/rehacer, guardar y exportar/importar el circuito en JSON. **Probar pista** utiliza el documento editado. La interfaz se adapta a móvil; los props manuales son decorativos y no tienen colisiones. La parte de IA queda aplazada. Detalles en [WORLD_SYSTEM.md](WORLD_SYSTEM.md).

## Código

- `src/config.js`: circuitos, sectores, coches, campeonato y condiciones.
- `src/circuit.js` y `src/physics.js`: recorrido, conducción y vueltas válidas.
- `src/career.js` y `src/career-ui.js`: medallas, desbloqueos, persistencia y pantallas de carrera.
- `src/vehicles.js` y `src/garage.js`: modelos compartidos entre pista y colección 3D.
- `src/world.js` y `src/environments.js`: escena, pista, biomas y meteorología.
- `src/camera.js`, `src/drift-effects.js`, `src/timing.js` y `src/performance.js`: seguimiento, efectos y rendimiento.
- `src/main.js`: estados, controles y sesión.
- Referencia original: [Starter-Kit-Racing, commit `40942fb`](https://github.com/mrdoob/Starter-Kit-Racing/tree/40942fbcefc833a80db6583040fcba27e0e7e6c1). El clon de consulta local en `reference/` no se incluye en este repositorio.

## Créditos y licencia

- [mrdoob / Starter-Kit-Racing](https://mrdoob.github.io/Starter-Kit-Racing/), MIT.
- Truck original, textura y humo: [Kenney](https://kenney.nl/), CC0, del repositorio original.
- Evo y Cobra: geometría propia procedural de Three.js, inspirada en las siluetas de los coches indicados, sin insignias de fabricante.
- Three.js y Vite, MIT. DM Sans y Barlow Condensed, SIL Open Font License, distribuidas mediante Fontsource.
- Se conserva el aviso original en `LICENSE`.
- Naturaleza, rocas, props y materiales PBR de [Poly Haven](https://polyhaven.com), [CC0](https://polyhaven.com/license). Los originales, licencias y checksums se conservan en `art/source/polyhaven/`.

## Biblioteca de arte de entornos

`/asset-library.html` permite revisar **16 modelos 3D y 20 materiales PBR gratuitos**, comparar LODs, ver sus mallas y probar agua animada. El juego incorpora los suelos y superficies PBR, vegetación texturizada, rocas y helechos con carga local e instancias. Véase [ENVIRONMENT_ASSETS.md](ENVIRONMENT_ASSETS.md) para el inventario por bioma, preparación, procedencia y límites de la primera integración.

## Interfaz y controles PRL

Interfaz compartida de gris carbón, rosa y azul claro, con foco visible y navegación de juego. Inspirada en la jerarquía de [Just Roll](https://mikemirage.github.io/just-roll/): paneles grises translúcidos en pista, números grandes para posición, cronómetro y velocidad, y el centro libre para conducir. El rosa identifica las acciones principales y la posición; el azul claro, vueltas, récords y trazado. Inicio, garaje, pausa, opciones, resultados y editor usan los mismos colores y componentes.

El velocímetro está activado por defecto en instalaciones nuevas; las preferencias existentes se conservan y puede cambiarse en **Opciones → Juego → Velocidad**. La pausa enfoca **Continuar**, mantiene la navegación con Tab dentro del menú y recupera el foco al cerrar Opciones. La ilustración de arranque es fija. El inicio muestra el coche 3D actual; el garaje y el editor ocupan su propia pantalla, con controles accesibles y zonas de desplazamiento internas.

- **Móvil:** dos zonas táctiles o trackpad analógico; aceleración automática. Ambas zonas o segundo dedo para frenar.
- **Teclado:** flechas o A/D para girar; ↓ o S para frenar. Aceleración automática. Esc/Espacio para pausa, R para reiniciar, C para cámara. Menús con flechas, Tab, Enter y Esc.
- **Ratón:** mantén clic izquierdo sobre la pista y mueve horizontalmente para girar; clic derecho para frenar. Menús y editor con controles nativos y arrastre 3D.
- **Mando estándar:** stick izquierdo / cruceta para girar; R2/RT para acelerar, L2/LT para frenar; Options/Menu para pausa. Triángulo/Y cambia cámara; cuadrado/X reinicia. Los menús se recorren con cruceta/stick; ✕/A confirma, ○/B vuelve y L1/R1 cambia de categoría. Stick derecho gira el coche del garaje.

El mando se lee con la [Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API) y el [mapeo estándar del navegador](https://w3c.github.io/gamepad/#remapping). Pulsa un botón después de conectarlo para que el navegador lo exponga. La desconexión del mando activo pausa la carrera. La detección depende del navegador y del mapeo que publique el dispositivo; los tests usan instantáneas simuladas, no sustituyen una prueba física del mando.

El editor conserva sus atajos de teclado, órbita, zoom y edición con ratón. Los originales de Higgsfield siguen en `art/splash-screens/prl-family-2026-11-02-v1/`; los recursos de carga locales están en `public/assets/prl/`. La interfaz compartida vive en `src/prl-theme.css`; la navegación de mando, en `src/gamepad.js`.

## Estudio Corvette C7 · Astra

Abrir [el garaje Corvette](http://127.0.0.1:5174/corvette-garage.html) con `npm run dev`. Estudio 3D independiente con pintura PBR, skins UV, neumáticos intercambiables, dirección y suspensión inspeccionables, estadísticas de referencia y descarga GLB. Se incluye en la compilación. Detalles de uso y alcance en [art/corvette-c7/GARAGE.md](art/corvette-c7/GARAGE.md); no añade automáticamente el coche al catálogo de carreras.

## Criterio de UX por dispositivo

El garaje, la preparación de carrera y la pausa deben poder completarse con táctil, teclado y mando. Mantener acciones principales de al menos 44 px, foco visible y recuperable, selección y vuelta sin ratón, desplazamiento interno accesible y coche completo en vertical, horizontal y pantallas pequeñas. No depender de hover o gestos sin alternativa visible.

La dirección táctil debe liberar entradas al pausar, cancelar un gesto o girar la pantalla; dos dedos frenan. Teclado y mando conservan sus indicaciones y navegación sin trampas de foco. Una prueba con mando en el navegador no certifica ejecución en una consola: iOS/Android y hardware de consola requieren validación física propia.

## Pruebas de nivel con piloto IA

Para las revisiones automáticas de interfaz o nivel, abrir el juego con `?autopilot=1` y preparar la sesión habitual. La IA de carreras controla dirección y freno mediante la física normal, también en entrenamiento; no se teletransporta el coche. Pausa, opciones y reinicio siguen disponibles. La etiqueta «PRUEBA IA · SIN GUARDAR» identifica estas sesiones: preferencias y resultados de la prueba permanecen en memoria, sin sobrescribir los guardados del jugador. Quitar el parámetro vuelve a la conducción normal. Este modo permite observar el trazado; no sustituye una prueba manual de los controles táctiles, teclado o mando.
