# RoadRushers · colección de 50 miniaturas

Diseño original inspirado en siluetas históricas, sin insignias ni logotipos. Se conserva la escala de juguete del juego: +Y arriba, +Z hacia delante. Los tres coches originales permanecen en su serie.

## Selección y orden de producción

| Tanda | Categoría | Modelos del juego → referencia de diseño |
| --- | --- | --- |
| 01 | Clásicos europeos | Bambino 59 → Fiat 500; Borough Cooper → Mini Mk I; Käfer 63 → Beetle; Parisienne 2 → 2CV; Bubble 57 → Isetta; Montane 110 → Alpine A110; Sovereign E → E-Type; Silber 300 → 300 SL; Speedwell 56 → 356 Speedster; Déesse 21 → DS |
| 02 | Muscle & hot rods | Deuce 32 → Ford 1932; Belvedere 57 → Bel Air; Stingray 63 → Corvette C2; Stallion 67 → Mustang; Rocoso SS → Camaro; Outlaw 69 → Charger; Challenger RT → Challenger; Phoenix 77 → Firebird; Tempest 65 → GTO; Venom 92 → Viper |
| 03 | Japón & rally | Hakone R34 → Skyline; Aichi A80 → Supra; Rotor FD → RX-7; Midori NA1 → NSX; Hachiro 86 → AE86; Fairwind Z → 240Z; Boxer 22 → Impreza 22B; Valle HF → Delta Integrale; Orbite HF → Stratos; Turbine 205 → 205 T16 |
| 04 | Deportivos & supercoches | Neun Turbo → 911/930; Rosso 40 → F40; Cuneo 84 → Countach; Miura S → Miura; Testa 84 → Testarossa; Woking F1 → McLaren F1; Molsheim 16 → Veyron; Modena Z → Zonda; Enduro 40 → GT40; Volt N → Nevera |
| 05 | Aventura & especiales | Willy 41 → Willys MB; Moorland 90 → Defender; Trailmaster 40 → FJ40; Mesa 66 → Bronco; Gelände G → Clase G; Badlands R → Raptor; Kombu 64 → Type 2; Dune 959 → Dakar 959; Superbird 70 → Superbird; Club Seven → Seven |

Cada ficha de `src/vehicle-catalog.js` fija anchura, longitud, altura libre, batalla, radio de rueda, estaciones de carrocería, seis medidas del habitáculo, faros y rasgos propios. Los detalles se modelan después de la silueta: aletas, entradas, branquias, parrillas, alerones, cromados, cajas de carga, jaulas o ruedas de repuesto según el vehículo.

## Contrato de personalización

- `exterior-paint`: pintura principal y mapa de wrapping. UV0 en atlas de paneles; laterales, techo/capó y testeros separados. Los detalles adicionales también tienen UV válidas.
- `secondary-paint`: color de techo, aletas o segunda carrocería; independiente del principal.
- `windows`: lunas separadas, con tinte, opacidad y rugosidad configurables.
- `rubber`: cuatro neumáticos sustituibles, independientes de las llantas.
- `rims`: cuatro llantas sustituibles, con color propio. Pivotes `steer-front-left/right` y `wheel-front/rear-left/right`; giro sobre X, dirección sobre Y.
- `headlights` y `taillights`: pilotos independientes; se conserva el encendido de freno del juego.
- `trail-rear-left/right`: anclajes en las huellas traseras, independientes de la decoración. `exhaust-left/right` para futuros efectos de escape. El efecto visual puede leerlos sin cambiar la carrocería.
- `customization`: metadatos y valores predeterminados en `userData`/extras de glTF; cada instancia posee sus materiales para no recolorear otros coches.

La geometría nativa de Three.js es la fuente editable y reproducible. `npm run models:export` escribe 50 GLB independientes y su manifiesto en `public/models/collection/`. `npm run models:qa` revisa posiciones/normales finitas, triángulos, dimensiones, UV de wrapping, pivotes, materiales, frenos y anclajes. Las capturas por tanda se guardan en `artifacts/`.

Los 50 coches son modelos de taller disponibles en entrenamiento. La Copa de Iniciación mantiene sus coches oficiales, sus desbloqueos y su guardado. La pintura y el resto de ajustes se guardan por coche en este navegador; los archivos de imagen de wrapping se aplican durante la sesión. Los anclajes de trails quedan listos para un sistema posterior de efectos cosméticos.
