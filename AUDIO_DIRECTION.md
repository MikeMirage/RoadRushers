# Dirección de audio · RoadRushers

## Estado de integración · 2 noviembre 2026

La biblioteca aportada por el usuario contiene nueve versiones Suno de seis composiciones. A y B están seleccionadas para uso. Se preservan los M4A originales (Opus dentro de MP4) y se preparan copias MP3 estéreo de 192 kbps para reproducción, con normalización en dos pasadas a −18 LUFS y objetivo de pico verdadero −2 dB. El catálogo conserva duración, medidas, procedencia y hash de cada original.

Menú y garaje usan Precision Objects. Puerto y costa usan Coastal Velocity A/B; bosque y Aserradero, Timberline Run A/B; lluvia y noche, Afterlight Express A/B. Faro y atardecer usan Coastal A/B; Golden Apex queda reservada a resultados por su duración breve. Entrenamiento añade One More Lap. Resultados usa Golden Apex (la entrega disponible dura 27,56 segundos). Las listas avanzan al final de cada tema con fundido, y alternan la versión inicial al volver a una misma sesión. Lobby, configuración y briefing mantienen Precision Objects hasta comenzar la cuenta atrás. En carrera, Siguiente recorre solo las siete versiones de conducción; lobby y resultados se incluyen únicamente al marcar la opción de prueba. La presencia musical es mayor en menús y resultados que durante la conducción. El desbloqueo de audio toma la pantalla actual en la interacción del usuario. La música Magnific anterior queda archivada en el panel y fuera de la selección del juego.

Coastal Velocity recibió «demasiado disonante» y queda fuera de la selección del juego; su revisión diatónica sigue pendiente. La importación de navegación y confirmación Magnific se desbloqueó y ambas quedaron locales. El feedback posterior aprueba también volver y aviso, pero pide simplificar aceptar y volver: ahora se utilizan WAV originales de una sola nota (1320 Hz y 660 Hz, 100 ms). Navegación mantiene su muestra Magnific y aviso mantiene el tono provisional. Las versiones anteriores se conservan para comparar en el panel.

La salida incorpora una bocina digital original con fundamental de 440 Hz y armónicos impares en 3, 2 y 1 (220 ms por pulso), y una señal de 880 Hz al salir (420 ms). Cada pulso se dispara al cambiar el número; cancelar la cuenta evita los siguientes pulsos. Se mezcla por Efectos; aceptar y volver por Interfaz. No se utiliza ninguna grabación de Gran Turismo. Los nuevos WAV se generan con `scripts/generate-ui-signals.py` y quedan pendientes de la escucha del usuario.

El sonido está habilitado por defecto y arranca con la primera interacción permitida por el navegador. Pausa y Opciones incluyen niveles persistentes de general, música, motor, efectos, ambiente e interfaz. Cambiar de pestaña silencia el juego. Las muestras de conducción se mezclan con capas de viento, lluvia, suelo y bordillo; esto sigue siendo una primera integración, con un único régimen de motor y sin validación auditiva final de los loops en conducción.

## Ajuste de conducción · neumáticos y superficies

El feedback posterior retira la aprobación del derrape original por su timbre de «tiza en pizarra». Se utiliza una nueva toma Magnific de goma en asfalto (8 s, 40 créditos), pendiente de escucha del usuario en conducción. El runtime recorta la banda de 2,7 kHz en 10 dB y filtra por encima de 1,25–1,7 kHz. El derrape entra progresivamente a partir de slip .18 y velocidad 1 m/s, sin chirrido de asfalto sobre grava, tierra, barro o hielo. Con lluvia se reduce la componente tonal.

Se reduce la ganancia máxima previa a los controles del usuario: neumáticos .48 → .14, grava .45 → .15 e impacto fuerte .75 → .30. La tierra usa la muestra granular más lenta, oscura y baja; barro e hielo usan rodaduras filtradas distintas. Viento, lluvia y bordillos bajan de nivel. El motor responde a acelerador y frenado con volumen y brillo, pero sigue partiendo de una única toma V8: aún no equivale a un banco de RPM por vehículo. Las recepciones usan un golpe grave breve original en lugar de un choque metálico. Los loops mezclan 35 ms de sus extremos para suavizar la unión. Falta validación auditiva final de esta mezcla.

## Revisión V2 · Magnific, 2 noviembre 2026

La escucha del usuario descarta la síntesis procedural anterior como dirección sonora. Las nuevas propuestas están en `public/audio/magnific-v2/` y se revisan en `audio-review.html`. El manifiesto distingue las tomas aprobadas de las pendientes; falta la mezcla final en conducción. La página reproduce archivos aislados y guarda valoraciones y notas por toma.

### Referencia y criterio musical

Gran Turismo no tiene una sola estética musical: la presentación de los coches y la conducción cumplen funciones distintas. La [selección jazz publicada para GT7](https://music.apple.com/us/song/1721838849) aporta una referencia de instrumentación y presentación, mientras que [PlayStation describe Find Your Line](https://blog.playstation.com/2022/02/04/tracklist-for-find-your-line-official-music-from-gran-turismo-7-announced/) como una selección de géneros y emociones para acompañar el juego. Nuestra interpretación para RoadRushers es: armonía elaborada y ejecución humana en el salón; pulso claro y gancho memorable durante la carrera.

Tres encargos originales: lounge de Rhodes, bajo eléctrico y batería a 96 BPM (ElevenLabs Music v2); house/UK garage costero a 124 BPM (Lyria 3 Pro); breakbeat líquido nocturno a 132 BPM (ElevenLabs Music v2). Son tempos pedidos en el brief, pendientes de medición y escucha. Los prompts piden desarrollo, variaciones, espacio para el motor y ausencia de voces. La música debe tener fraseo, articulación, contraste y una mezcla que se sostenga durante varios minutos. Cambiar solo tempo o tonalidad de un patrón no da identidad suficiente a un circuito.

### Referencia y criterio para FX

La [presentación técnica de Polyphony en GDC](https://s3.amazonaws.com/gran-turismo.com/pdi_publications/GDC_2024_GT7_SOUND.pdf) describe un proceso de grabación, edición, creación de assets e implementación. Esa cadena es la referencia de trabajo. Las propuestas ElevenLabs solicitan fuentes físicas aisladas: escape V8 estable, goma en deslizamiento, grava bajo el coche y dos impactos de guardarraíl. No se deben confundir con grabaciones auténticas del vehículo.

Para un motor creíble hacen falta ralentí, carga y retención en varios regímenes, capas de admisión/escape/transmisión, coherencia de fase y crossfades por RPM. Un clip aislado de ocho segundos solo permite valorar el timbre. Antes de integrarlo: escuchar si mantiene régimen, comprobar cortes y clicks del loop, comprobar la escala del impacto, buscar música o voces accidentales, comparar dinámica y ajustar volúmenes con el coche en movimiento. El usuario ha aprobado el timbre de estas tomas aisladas; quedan por validar sus loops y respuesta dinámica durante la conducción.

El manifiesto `sources.json` conserva modelo, procedencia y archivo de cada toma. Las tomas aprobadas sustituyen las fuentes procedurales de motor, neumático, grava e impacto.

## Archivo de la propuesta V1 descartada

### Identidad

Audio de carreras cercano, táctil y melódico. La referencia emocional combina la tensión limpia de una retransmisión de motorsport con instrumentales electrónicos breves y memorables. Son referencias de energía y acabado; la música y los sonidos deben ser composiciones originales, sin calcar melodías, arreglos ni grabaciones de otras obras.

La mezcla prioriza, en este orden, motor, lectura del agarre y peligro, música y ambiente. El motor debe comunicar carga y velocidad; el neumático debe contar si el coche conserva el apoyo; cada cambio de terreno debe sentirse incluso con la vista en la curva. La música acompaña la conducción y deja hueco al coche.

## Soundtracks por pantalla y circuito

El generador compone música original en Web Audio y cambia de arreglo según la pantalla. Cada arreglo tiene tempo, armonía, patrón rítmico y motivo propios. Las carreras tienen temas deterministas por circuito: Puerto lleva un pulso costero abierto; Aserradero usa un break más sincopado y grave; Faro tiene un motivo luminoso de atardecer. Los circuitos creados por el jugador reciben un tema estable derivado de su identificador y bioma.

- **Menú / hub:** tema espacioso, con poco bombo y motivo de bienvenida.
- **Garaje:** groove más marcado y brillante que da energía sin competir con la inspección del coche.
- **Carrera:** tema propio por circuito; la velocidad sube la intensidad y el clima húmedo cambia la armonía.
- **Resultados:** arreglo más abierto y celebratorio, con mayor presencia melódica.

Los temas usan patrones originales de bajo, percusión sintética, notas cortas y acordes sostenidos. No incluyen melodías con licencia ni intentan reproducir canciones de referencia.

Para una producción final, sustituir o complementar el generador con stems compuestos y mezclados por separado:

- **Drive:** break electrónico, bajo redondo y motivo de pocas notas; entrada de percusión progresiva al acelerar.
- **Focus:** arreglo más aireado para curvas técnicas, con percusión reducida y más espacio para motor y neumáticos.
- **Night / wet:** acordes más fríos, textura amplia y menos brillo; la lluvia mantiene su presencia fuera del centro estéreo.
- **Finish:** acento musical breve al cruzar meta y salida musical suave al volver al menú.

La música de juego debe poder silenciarse sin afectar efectos. Objetivo de mezcla: música claramente por debajo del motor en carga y ducking suave de 2–3 dB ante derrape fuerte o impacto.

## Efectos del prototipo

`src/audio.js` usa Web Audio local, sin descargas ni dependencias externas. El audio se inicia después de una pulsación del usuario para cumplir las restricciones de reproducción del navegador.

- **Motor:** diente de sierra filtrado, armónico y admisión de ruido; tono y brillo siguen velocidad/carga, con transitorio al cambiar de rango de marcha.
- **Neumático:** ruido filtrado y silbido controlado por el deslizamiento medido por física.
- **Rodadura:** banda de ruido dependiente de asfalto, grava, tierra, barro o hielo.
- **Bordillo:** vibración de baja frecuencia al rodar cerca del borde marcado de pista.
- **Viento:** ruido filtrado que crece con velocidad y se abre en el aire.
- **Lluvia:** capa aguda suave condicionada por el clima.
- **Impacto / recepción:** transitorios breves activados por impacto y aterrizaje físicos.
- **Música:** bajo, pad, hats, percusión y motivo corto, generados en la secuencia local.

Las capas se suavizan con rampas de ganancia para evitar clics y se agrupan en buses con compresión ligera. La opción de sonido activa o silencia música y efectos juntos en esta primera integración.

## Barra de calidad para producción AAA

La síntesis actual da identidad y hace audible el estado del juego, pero no sustituye un paquete de grabaciones profesionales. Para llegar a calidad AAA, capturar cada coche por separado en ralentí, aceleración y retención, varios regímenes y posiciones de micro; grabar admisión, escape, cabina, exterior, transmisión, neumático sobre cada superficie, bordillo, suspensión, impactos y clima. Limpiar, editar y diseñar capas con variantes para evitar loops evidentes. Hacer pruebas en altavoces de portátil, auriculares, móvil y mono.

El objetivo de diseño es legibilidad sin fatiga: transitorios cortos, estéreo estable en móvil, limitación de voces, filtros de paso alto en capas con graves innecesarios y mezcla que preserve el espacio del motor. Priorizar una captura auténtica y mezcla por vehículo antes de sumar más capas sintéticas.
