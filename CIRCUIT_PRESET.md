# Club Circuit · acabado de pista

En **Circuitos → Editor de pistas**, pulsa **Generar acabado · 1 clic**. El editor muestra el resultado y lo guarda automáticamente con el circuito. **Probar pista** carga ese mismo acabado. Exportar/importar JSON conserva la distribución. Se puede quitar, regenerar o deshacer.

## Criterio visual

El preset se centra en la pista y su equipamiento, sin temática geográfica. Conserva las bandas originales en ambos lados, con sus posiciones, anchura, altura y cadencia; cambia naranja/blanco por rojo/blanco. Las piezas dejan juntas para evitar parpadeos por superficies superpuestas en las curvas. Editor y carrera utilizan el mismo constructor de bandas. El generador no fabrica pianos alternativos ni sustituye las bandas existentes.

- Asfalto local PBR a escala de cuatro metros, normales, rugosidad, variación amplia y desgaste discreto.
- Arcenes de hormigón y franjas de grava. Los márgenes anchos se limitan al terreno casi horizontal.
- Barreras cortas de tres neumáticos por pila, en el exterior de curvas. Pilas contiguas, pintura por bloques rojos y blancos, perfil con flancos y relieve de rodadura en shader. Su centro está a 1,65 m del borde de la calzada.
- Paneles publicitarios PRL junto a rectas, orientados hacia la pista, con reverso opaco y soportes.
- Suelo de apoyo sobrio; no se añaden bosques, edificios temáticos ni partículas.

Las siguientes familias deberían seguir esa lógica funcional: vallas y guardarraíles, referencias de frenada, puestos de comisarios, señalización y salida/meta. Su posición debe responder al trazado y a espacios disponibles.

## Generación y guardado

`src/circuit-dressing.js` resuelve las franjas y colocaciones con un índice espacial de todas las ramas del circuito. Comprueba espacio respecto a otras calzadas y respeta huecos y túneles. Las zonas elevadas conservan sus estructuras; no se inventan explanadas suspendidas.

El documento guarda `circuitDressing`: versión, preset, firma del trazado y distribución resuelta. Al cargar se construyen las mallas; no se repite el análisis ni se ejecuta el generador durante la carrera. Cambiar geometría o anchura invalida el acabado. Renombrar conserva la distribución. La primera versión experimental (bandas sustituidas y neumáticos dispersos) requiere pulsar Generar de nuevo; la pista se conserva.

El decorado es visual. La física y las colisiones siguen utilizando el trazado original; las escapatorias y neumáticos no añaden nuevas superficies conducibles ni cuerpos físicos.

## Coste y validación

- Máximo: 6.000 franjas, 144 pilas de neumáticos y 48 paneles.
- Instancias y franjas agrupadas por celdas espaciales de 80 m para descarte fuera de cámara.
- Materiales y texturas compartidos. Césped con albedo y variación amplia; PBR completo reservado principalmente al asfalto.
- Sin luces nuevas ni postprocesado adicional. Neumáticos con sombra de contacto económica.
- Guardados de ejemplo: aproximadamente 6–13 KB; los recursos gráficos se comparten entre pistas.

`node --test tests/circuit-dressing.test.js tests/track-editor.test.js tests/saved-tracks.test.js tests/local-occlusion.test.js` comprueba persistencia, exportación, carga en carrera, invalidación, presupuestos, corredores, atributos de oclusión y conservación de bandas.

`artifacts/circuit-dressing/review.html` es una revisión local servida por Vite: compara base/acabado, ofrece tres tracks y mide CPU, GPU si está disponible y tiempos de fotograma con un coche y cámara en movimiento. No equivale a una carrera con IA ni a una prueba en teléfonos físicos.

## Infraestructura y controles

El editor incorpora activación y densidad independientes de **Guardarraíles**, **Vallas de protección** y **Publicidad**. Los cambios sobre un acabado generado actualizan y guardan únicamente su infraestructura; conservan las franjas y las pilas de neumáticos existentes. Los documentos anteriores siguen siendo compatibles. Pulsar Generar/Regenerar incorpora los valores elegidos.

El guardarraíl ondulado va a 3,8 m del borde, detrás de los neumáticos; la malla se retira a 4,5 m. Se comprueban las ramas vecinas y los gálibos. La publicidad sigue esas barreras con tres diseños originales compartiendo un atlas. Al desactivar ambas protecciones, la publicidad utiliza los paneles independientes. Todos son elementos visuales.

La infraestructura se agrupa por material y celdas de 80 m, con malla recortada en shader y sin nuevas luces ni sombras dinámicas. Límites adicionales: 1.200 tramos de guardarraíl, 800 de valla y 96 paneles integrados. La prueba local con un coche mantuvo 8,3 ms de mediana por fotograma; no sustituye pruebas con IA o en móviles.

## Frenada y salida/meta

El preset resuelve y guarda `markers` con un máximo de 48 carteles de distancia, dos señales laterales de salida/meta y ocho cajones de parrilla. Los carteles indican metros reales a lo largo del trazado hasta el comienzo de una curva cerrada: 150/100/50 m en aproximaciones largas y 30/20/10 m en cortas. Se omiten si falta recta, apoyo o espacio respecto a otra rama o los neumáticos.

La línea de cuadros existente se conserva. Las señales laterales identifican salida/meta y los cajones se dibujan solo en aproximaciones rectas compatibles con el espacio disponible. Son referencias visuales; no cambian las posiciones físicas de parrilla. Se comparten un atlas y tres mallas estáticas (postes, carteles y pintura), sin luces nuevas. Los presets ya guardados pueden incorporar los marcadores al regenerar o al actualizar un control de infraestructura.

## Césped procedural luminoso

El suelo de Club Circuit usa una paleta verde y un shader propio, sin los mapas PBR de césped seco. Combina variación amplia, bandas de corte muy discretas y grano fino atenuado por la huella de píxel para evitar ruido a distancia.

Como detalle cercano hay hasta 2.400 matas opacas de tres triángulos (7.200 triángulos), agrupadas en un máximo de 24 celdas. El shader reduce su altura entre 45 y 85 m y mueve las puntas con un viento suave. No utiliza tarjetas transparentes ni nuevas sombras proyectadas; solo se actualiza un uniforme temporal por grupo visible. La distribución es determinista, se construye al cargar y excluye la carretera y las franjas de grava/hormigón. El acabado se aplica también a los presets guardados sin tener que regenerar su infraestructura.

Referencias técnicas consultadas: [AMD GPUOpen: Procedural grass rendering](https://gpuopen.com/learn/mesh_shaders/mesh_shaders-procedural_grass_rendering/) (parches y reducción de detalle con distancia) y [Three.js: InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html) (instancias y límites para descarte espacial). La implementación del proyecto utiliza GLSL/WebGL; no incorpora el pipeline de mesh shaders de AMD ni código de esos ejemplos.

Las matas se agrupan en parches de aproximadamente 5 × 3 m. Su altura es de 32–54 cm y su anchura aproximadamente el doble de la primera versión; se mantiene el mismo máximo de 2.400 matas y 7.200 triángulos. El margen de exclusión crece para acomodar la nueva silueta.

## Comisarios, señales y protecciones elevadas

El campo `facilities` guarda hasta 12 puestos, 32 señales y 1.200 tramos de protección elevada. Se incorporan al generar el preset o al actualizar infraestructura de un preset anterior; posteriores cambios de densidad conservan la distribución.

Los puestos son plataformas abiertas con escalera, cubierta naranja e identificación. Se sitúan junto a entradas de curvas cerradas o crestas, con separación mínima entre puestos, terreno casi horizontal, espacio para su huella y comprobación de visión hacia el tramo anterior. Se evita invadir la carretera, los neumáticos, los carteles existentes y los props manuales registrados.

Las señales indican izquierda, derecha o peligro antes de crestas. Se colocan antes de la entrada a la curva y miran hacia quien se aproxima. Se omiten cuando no hay espacio.

Las protecciones de puentes siguen ambos bordes a 0,72 m fuera de la calzada, con dos bandas y postes de 1,15 m. Siguen la altura y el peralte del trazado, comprueban otras ramas y se interrumpen en túneles y huecos de salto. Son decorativas y conservan las colisiones actuales.

La geometría se agrupa por material y sectores de 80 m, sin luces ni sombras proyectadas nuevas. Mantiene los atributos del sistema de visibilidad bajo puentes. La revisión local incluye «Ver equipamiento» para encuadrar puente y puestos.

## Publicidad legible y exclusión de pasos elevados

La publicidad integrada usa paneles completos de 6 × 1,6 m, soportes de 2,4 m y reverso metálico. Cada diseño ocupa el panel entero, aunque la malla se subdivida para acompañar una curva suave. Se limita a 32 paneles y una separación longitudinal de al menos 18 m entre grupos, sobre soportes continuos en tramos casi horizontales y poco curvados.

Antes de colocar un panel se muestrea a intervalos de un metro toda su longitud y la anchura de la calzada adyacente. Un índice de todas las ramas excluye los pasos bajo cualquier vía superior, aunque no interfiera físicamente con el panel lateral. También se excluyen túneles, saltos y pendientes fuertes. La validación se aplica al construir el render de presets antiguos: los fragmentos estrechos o paneles en sitios inválidos se omiten. Regenerar o actualizar infraestructura guarda la nueva distribución. «Ver publicidad» en la revisión local permite inspeccionar cada panel desde su cara legible.

Los grupos publicitarios reservan además al menos cuatro metros a ambos extremos respecto a señales de frenada, curva y salida/meta del mismo lado. El texto mantiene su orientación correcta en ambos lados de la pista. La revisión omite los fragmentos antiguos; la nueva distribución completa se obtiene con Regenerar acabado.

## Publicidad triangular para cámara cenital

El modelo publicitario actual sustituye las superficies verticales por prismas triangulares de 4 m de altura, 6 m de longitud y 4,6 m de fondo. Ambas caras inclinadas llevan el diseño completo; el eje de lectura se orienta según la proyección de la cámara cenital fija del juego. Las caras tienen componente normal hacia arriba para resultar visibles desde esa cámara.

La base empieza 0,5 m por fuera del soporte de referencia (guardarraíl o valla). Las comprobaciones de espacio se amplían a toda la base, una altura de 4,2 m y los puestos y props próximos. Se mantienen las exclusiones bajo otras vías, junto a señales y en tramos no adecuados. Los paneles independientes usan el mismo prisma. El volumen tiene 20 triángulos por anuncio, agrupados en los materiales y sectores existentes, sin nuevas luces ni sombras proyectadas. Recargar actualiza la forma; regenerar vuelve a resolver la distribución.
