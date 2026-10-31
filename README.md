# RoadRushers · prototipo 02

Carreras 3D con aceleración automática y solo dos controles de dirección. Esta versión añade una primera carrera con medallas, desbloqueos y una colección de coches en 3D, partiendo de [Starter Kit Racing de mrdoob](https://github.com/mrdoob/Starter-Kit-Racing).

**[Jugar en GitHub Pages](https://mikemirage.github.io/RoadRushers/)** · [Repositorio](https://github.com/MikeMirage/RoadRushers)

## Ejecutar

```sh
npm ci
npm run dev
```

Abrir `http://127.0.0.1:5174/` en un navegador con WebGL. Los modelos, el humo y las tipografías se sirven localmente; no requiere claves ni servicios externos.

```sh
npm test          # Conducción, vueltas, cámaras y progresión
npm run build    # Compilar a dist/
npm run preview  # Probar la compilación
```

## Publicación en GitHub Pages

El workflow `.github/workflows/pages.yml` instala las dependencias, ejecuta los tests, compila y publica cada actualización de `main`. Se puede lanzar también desde Actions. GitHub Pages utiliza la fuente **GitHub Actions**. La compilación recibe la ruta base de Pages, para que funcionen los modelos, fuentes y enlaces dentro del subdirectorio del repositorio.

Para comprobar esa ruta localmente:

```sh
npm run build -- --base /RoadRushers/
npm run preview
# Abrir http://127.0.0.1:4174/RoadRushers/
```

## Carrera IA

**Carrera IA** en la pantalla principal abre la configuración de una parrilla de 4, 8 o 12 coches, con 1, 3 o 5 vueltas. Puedes comparar **Ghosts** y **Con contacto**, y anchuras base original, 12, 14 o 16 m cuando el trazado lo permite. El coche se elige en el garaje. Los rivales locales usan esa misma clase, con distintos ritmos, colores, apodos y trazadas.

La dificultad se elige entre **Novato, Club y Experto**, con parrilla variada o uniforme. Todos usan los parámetros físicos del jugador; el nivel cambia sus decisiones de conducción, adelantamiento y defensa.

Posición en directo, parrilla escalonada, minimapa con rivales y resultado al llegar a meta. La IA conduce con la física y el freno del juego, respeta los dos niveles de los puentes y puede buscar huecos o frenar en modo contacto. Ver [reglas y funcionamiento de la carrera](RACE_MODE.md).

## Kit modular de circuitos

Abrir **Tramos** en la barra superior para inspeccionar y montar 21 tipos de piezas: rectas, curvas de tres radios, enlaces de 45°, horquillas, chicanes, peraltes, rampas, puente, badenes y cresta de salto. El banco muestra sus conexiones y medidas en 3D; permite añadir piezas, quitar la última, deshacer, guardar un borrador local y probar montajes cerrados.

Incluye **Club técnico**, **Ocho elevado** y **Rally de crestas**, con altura real, cruces a distinto nivel y física de vuelo y aterrizaje. Se prueban en un entorno neutro para evaluar primero los tramos. Ver [definición del kit y reglas de montaje](TRACK_KIT.md).

## Copa de Iniciación

Cada prueba es una vuelta con coche, materiales, clima y ritmo oficiales. Un bronce abre la siguiente prueba. Los mejores resultados se conservan y pueden mejorarse sin perder medallas.

| Prueba | Coche | Oro | Plata | Bronce |
| --- | --- | --- | --- | --- |
| Curvas del Puerto | Truck Classic | 31 s | 41 s | 62 s |
| Lazos del Aserradero | Evo Rally | 34 s | 45 s | 68 s |
| Horquillas del Faro | Evo Rally | 39 s | 52 s | 78 s |

Bronce vale 1 punto, plata 2 y oro 3. Completando las tres pruebas, la copa es de bronce con 3 puntos, plata con 6 y oro con 8. El primer bronce desbloquea el Evo Rally; completar las tres pruebas desbloquea el Cobra 427. El guardado es local al navegador y dispositivo. Si el almacenamiento no está disponible, se puede progresar durante la sesión.

Ocho controles ordenados validan cada vuelta y rechazan el sentido contrario y los saltos de recorrido. El entrenamiento usa récords independientes por circuito, coche, superficie, clima y ritmo, y no concede recompensas de campeonato.

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
| Flechas en pantalla | Una para girar; ambas a la vez para frenar |

El coche acelera solo. Mantener izquierda y derecha a la vez corta el acelerador y aumenta suavemente la presión del freno hasta detenerlo si se mantiene. Soltar una dirección libera el freno, vuelve a acelerar y permite entrar en la curva con esa dirección. El agarre de la superficie y el clima afectan a la distancia de frenado. Los tres coches encienden sus pilotos traseros rojos al frenar y proyectan un halo rojo sobre la carretera mediante un degradado, sin luces dinámicas; sigue la altura y el peralte del tramo. Entra con velocidad y mantén el giro para derrapar; suelta o aplica contravolante para recuperar la trayectoria. Humo y marcas representan el deslizamiento real. Superficie, clima y perfil del coche modifican el agarre y la velocidad. Los guardarraíles contienen el coche sin rebotes repetidos. Al cambiar de pestaña se pausa y libera los controles.

La cámara aérea es alta, alejada y de orientación fija, con margen para ver el coche deslizar dentro del encuadre. La tercera persona sigue la dirección del movimiento con más distancia. Física a 120 Hz, poses interpoladas, sombras estáticas, paisaje agrupado y resolución adaptativa mantienen las mejoras de estabilidad del prototipo anterior; grava y tierra no añaden vibración artificial.

`http://127.0.0.1:5174/?stats=1` muestra FPS, tiempo de render, llamadas de dibujo y resolución. Solo aparece al solicitarlo en la URL. Esta versión tiene progresión y récords locales; la economía, torneos online y ELO quedan para una siguiente fase.

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
