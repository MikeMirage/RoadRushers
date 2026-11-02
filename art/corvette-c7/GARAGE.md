# Corvette C7 — estudio interactivo de RoadRushers

Abrir `http://127.0.0.1:5174/corvette-garage.html` con el servidor de desarrollo del proyecto (`npm run dev`). La página también se incluye en `npm run build` y respeta la ruta base de publicación.

El estudio presenta la geometría GLB real con iluminación PBR y cámara orbital. Permite cambiar pintura, acabado, skin procedural o imagen UV, color de llantas y neumáticos; variar altura de carrocería; inspeccionar giro de dirección, rodadura, suspensión y malla; descargar el GLB y una captura PNG. Pintura y ajustes se guardan localmente; las imágenes aportadas solo duran la sesión. Restablecer elimina la configuración visual actual.

Las cifras 461 CV y 623,2 N·m se transcriben de la captura de referencia proporcionada por el usuario. La cilindrada de presentación es 6,2 L. No son parámetros de la física del juego ni resultados de una simulación. Los cambios de neumáticos y suspensión del estudio son visuales. Este recurso es una referencia compatible con Three.js, no una nueva entrada automáticamente seleccionable en las carreras.

## Contrato de integración

```js
import { loadCorvette } from '../../src/corvette-model.js';
const model = await loadCorvette();
scene.add(model.group);
model.setCustomization({ paint: '#045d91', finish: 'gloss', tire: 'sport' });
model.setPose({ steering: 0.25, spin: 2, suspension: 0.01 });
```

Metros, +Y arriba, +Z hacia el frontal. La geometría distingue carrocería suspendida, suspensión por rueda, pivote de dirección y rodadura. El adaptador expone `group`, `bodyRig`, `wheels`, `frontWheels` y materiales para conectar el consumidor del juego. No debe llamarse simultáneamente a `setPose` y al animador del juego sobre los mismos pivotes.

La compatibilidad de formato y jerarquía no equivale a validar una parrilla completa en móviles: medir draw calls, memoria y FPS en el dispositivo objetivo antes de incorporarlo al catálogo de carreras.

## Referencias y autoría

Modelo realizado por Astra mediante modelado procedural a partir de las dos imágenes aportadas en esta conversación: collage de cuatro vistas de un Corvette C7 azul y captura de un garaje de Gran Turismo. Esas referencias se usan para proporciones y presentación; no se redistribuyen como texturas. No se ha importado geometría comercial de terceros. La página es un estudio no oficial, sin afiliación con Chevrolet.

La skin se multiplica por el color de pintura. Seleccionar blanco conserva los colores originales de la imagen. La plantilla UV descargable usa un atlas de seis vistas; los cambios de proyección entre caras pueden requerir ajustar las juntas del diseño.
