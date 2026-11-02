# Corvette Stingray C7 — modelo editable y contrato web

Modelo original construido mediante superficies y componentes paramétricos a partir de las cuatro vistas aportadas por el usuario. La entrega es una interpretación reconocible del C7 para el garaje de RoadRushers, con detalle de ruedas, ópticas y carrocería. **No es un escaneo, un CAD de Chevrolet ni una réplica fotorealista certificada.** Algunas proporciones locales, transiciones de paneles e interiores siguen simplificados.

## Entrega

- `corvette-c7.blend`: fuente Blender 4.4.3, 1.584.640 bytes, 1.058 piezas de malla editables y 1.073 objetos. El control está en `CTRL_Corvette`; guardado en pose de reposo.
- `../../public/models/corvette-c7/corvette-c7.glb`: GLB final, 5.104.248 bytes. Las piezas inmóviles se agrupan por material y padre rígido.
- `../../public/models/corvette-c7/skin-template.png`: plantilla de pintura 1.536 × 1.024, extraída de los UV reales exportados.
- `../../src/corvette-model.js`: carga, rig runtime, variantes y materiales.
- `garage-preview.jpg`: captura del garaje en el navegador realizada en la integración.
- `review-random.png` y `review-wire.png`: revisión multivista del GLB final. El wireframe muestra aristas reales, incluidas las ocultas; no añade geometría de visualización al modelo.
- `front-three-quarter.png`, `rear-three-quarter.png`, `side.png`: renders de estudio de la última revisión de forma. La posterior corrección de alojamientos pequeños de luces traseras se verifica en el GLB y las láminas finales.

La geometría y los materiales son originales; no se ha incorporado ningún modelo comercial descargado ni texturas de terceros. La referencia de medidas procede de la [ficha técnica del folleto Chevrolet Corvette 2014](https://cdn.dealereprocess.org/cdn/brochures/chevrolet/2014-corvette.pdf). Las marcas y el diseño de referencia identifican el vehículo representado; el emblema se interpreta con geometría simplificada.

## Medidas y presupuesto verificados

| Dato | Resultado del GLB |
| --- | ---: |
| Triángulos | 120.210 |
| Mallas / primitivas de material | 43 |
| Materiales exportados utilizados | 14 |
| Longitud completa | 4,489339 m |
| Anchura completa, incluidos espejos | 2,100000 m |
| Altura | 1,239500 m |
| Batalla | 2,710000 m |
| Neumático deportivo opcional añadido por runtime | 6.144 triángulos / 8 mallas |

Es una única representación de detalle para exposición. No incluye LODs, Draco/Meshopt, colisión física, reparto de masas o tuning de conducción. Los 43 materiales/primitivas agrupados no representan el número total de pasadas del renderizador cuando se activan sombras. No se ha validado una parrilla de muchos coches de este detalle ni rendimiento móvil.

## Rig y APIs

El GLB usa metros, **+Y arriba y +Z hacia el frontal**. Blender usa Z arriba y −Y frontal, con conversión normal del exportador glTF. No aplicar una segunda rotación de ejes.

```text
CorvetteC7
├── BodySuspension
│   └── carrocería, cristales, luces e interior
├── Suspension_FL / FR / RL / RR
│   └── Steering_FL / FR / RL / RR
│       ├── pinza de freno (no gira con la rueda)
│       └── Wheel_FL / FR / RL / RR
│           └── goma, llanta, disco y detalles
└── CTRL_Corvette (fuente Blender)
```

Rig mecánico de objetos rígidos: no necesita deformación de piel ni armature. El archivo Blender tiene drivers para `steering`, `wheel_spin`, `ride_height` y `suspension`. El GLB exporta la jerarquía y los pivotes en reposo; los drivers se sustituyen por el adaptador JavaScript. No hay clips de animación horneados.

```js
import { loadCorvette } from './src/corvette-model.js';
const model = await loadCorvette();
scene.add(model.group);
model.setCustomization({
  paint: '#045d91', finish: 'gloss', wrap: 'stripes',
  rimColor: '#252b31', tire: 'street', rideHeight: 0,
});
model.setPose({ steering: 0.2, spin: 1.5, suspension: 0.01 });
```

`loadCorvette()` devuelve `group`, `bodyRig`, `wheels`, `frontWheels`, `suspensionPivots`, `wheelSlots`, `materials`, `stats`, `setCustomization`, `setPose` y `dispose`. También existen `preloadCorvette()` y `createCorvetteModel(scene)` para carga anticipada o validación sin navegador.

- `wheels`: giro alrededor de X local. `frontWheels`: dirección alrededor de Y local.
- `setCustomization`: `paint`, `finish` (`gloss/satin/matte`), `wrap` (`none/stripes/race`), `rimColor`, `tire` (`street/sport/slick`), `rideHeight` en metros, `texture` (`THREE.Texture` o `null`). `color` es alias de `paint`.
- `setPose`: `steering` y `spin` en radianes; `suspension` en metros. `cornerSuspension` opcional permite offset por `FL/FR/RL/RR`.
- El cuerpo cambia de altura sin arrastrar los centros de las ruedas. La demo es visual; no es un solver de suspensión ni una garantía de ausencia de intersecciones para poses externas extremas.
- La dirección está limitada a ±0,45 rad; el adaptador limita altura a −0,045/+0,07 m y la oscilación adicional a ±0,025 m. El garaje usa rangos más reducidos.
- Los neumáticos mantienen el radio de rodadura. Street conserva dibujo, sport muestra dos canales y mayor anchura, slick elimina los canales y ensancha la carcasa. Son variantes geométricas del mismo conjunto, no marcas comerciales ni simulaciones de compuesto.
- Las llantas conservan el diseño de radios Y y permiten cambiar el material/color. No hay un catálogo de diseños de llanta alternativos.
- Para personalizar este asset usar **`model.setCustomization`**. El helper antiguo `customizeVehicle` que reemplaza geometrías de llanta de coches procedurales no es el adaptador de este GLB.

## Pintura, atlas y límites de las skins

Los paneles usan un atlas de seis proyecciones en una cuadrícula 3×2. En el PNG exportado, fila superior: lado derecho / superior / frontal; fila inferior: lado izquierdo / inferior / trasera. Se reserva 2,5% de margen por celda. El exportador invierte V respecto a Blender; el adaptador establece `texture.flipY = false`.

La proyección es continua en el espacio del vehículo dentro de cada orientación, de modo que franjas y números pueden cruzar piezas. **No es un unwrap único libre de solapes:** la comprobación aproxima un 15,47% de solape en pintura, principalmente proyecciones de piezas superpuestas/recortes. Eso limita logos únicos sobre zonas superpuestas y bakes de AO/normales. Para una livery de competición precisa en cada pieza sería necesario un atlas manual sin solapes y adaptar la plantilla. La plantilla actual y la carga de PNG fueron probadas en el garaje.

Los materiales PBR de color sólido son editables, con barniz de pintura y espacios de color glTF. No se entregan mapas fotográficos de microdetalle, suciedad, normal o AO. Cristales opacos oscuros reducen problemas de transparencia; el interior es una representación sencilla para lecturas oblicuas.

## QA final y advertencias aceptadas

**`qa-final.json`: `pass: true`, cero errores, 32 advertencias.** Se revisaron las láminas de materiales por grupos, las aristas reales, los renders de estudio y el modelo en el garaje. Se corrigieron tubos con último anillo invertido, raíces de radios superpuestas, pequeñas caras degeneradas, curvatura de paneles, UV de bevels y respaldos de ópticas/espejos.

Las 32 advertencias se aceptan expresamente por estos motivos:

- **18 advertencias de solape UV.** Las piezas PBR y las proyecciones del coche comparten atlas intencionadamente. No afectan al color/material uniforme, pero limitan bakes y skins únicas como se explica arriba.
- **9 advertencias de vértices próximos** dentro del umbral de 10 micras. Corresponden a pequeños bevels, costuras y encuentros entre piezas; no hay vértices sueltos ni caras degeneradas en la validación final. No se fusionan todas esas piezas porque se preservan sus normales, UV y separación funcional.
- **5 advertencias de caras ocultas espalda contra espalda:** 384 pares por neumático delantero, 260 pares entre respaldo de carbono y cristal, 124 entre cristal y óptica, y 8 entre respaldo de carbono y rejilla. Son interfaces de piezas cerradas y añaden algo de geometría oculta. Se conservan para que los subconjuntos sigan siendo cerrados y reemplazables.

`qa-raw.json` conserva la salida sin adaptación del helper. El GLB duplica vértices en costuras UV/normales, lo que hace que un comprobador basado en índices confunda bordes adyacentes con caras coplanares superpuestas. Para `qa-final.json` se soldaron posiciones idénticas a 0,1 micra en **una copia temporal de QA**, con un assert por malla de que no desapareció ninguna cara. La geometría exportada no se modifica por ese paso. Además se promueve el cálculo escalar de volumen a float64: el dot/cross float32 del helper cancelaba el volumen de algunos taladros de rotor de 3 mm trasladados metros respecto al origen. Los umbrales de comprobación se conservan. Ambas adaptaciones y los conteos por malla están registrados en el JSON y en `scripts/corvette-qa.py`.

`runtime-check.json` verifica carga GLB, pivotes, dirección/giro, suspensión con centros de rueda inmóviles, escala unitaria, variantes de neumático, aislamiento de materiales y límites. `native-rig-check.json` verifica los drivers del `.blend`: dirección 0,35 rad, ruedas 1,57 rad, carrocería −20 mm y deriva de centros de rueda **0 m**, restaurando después el reposo. Esos checks no sustituyen una simulación de colisiones o pruebas de conducción.

## Reconstrucción

Desde la raíz del repositorio, usando el Blender instalado:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 -P scripts/corvette-build.py
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 -P scripts/corvette-qa.py
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 -P scripts/corvette-native-check.py
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 -P scripts/corvette-review.py
python3 scripts/corvette-wireframe.py
python3 scripts/corvette-skin-template.py
node scripts/corvette-runtime-check.mjs
```

El generador admite `-- --skip-renders`. Los helpers de QA/revisión usan la instalación local de `blender-asset-qa`; los dos scripts de PNG necesitan Pillow. Los renders wireframe usan aristas proyectadas porque el modificador wireframe del helper con grosor fijo producía picos artificiales en detalles milimétricos. No se incluyen esos renders defectuosos.
