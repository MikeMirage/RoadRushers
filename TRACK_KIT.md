# Kit de tramos · versión 1

Primero se valida la conducción y el montaje con una maqueta neutra. Los biomas se trabajarán después sobre recorridos construidos con estas piezas.

## Contrato de conexión

Cada pieza empieza en el origen, mira hacia +Z y usa +Y como altura. El ancho estándar es de 10 m. Las conexiones tienen pendiente longitudinal y peralte cero, de modo que un tramo pueda conectarse al siguiente sin escalones ni cambios bruscos de orientación. Las curvas terminan con su tangente de salida y las rampas suman o restan altura.

El compilador coloca cada pieza a continuación de la anterior: traslada y gira sus puntos, acumula longitud y conserva la identidad del tramo. El dibujo, las colisiones, la cámara, los derrapes, el minimapa y las puertas de vuelta consultan ese mismo recorrido tridimensional.

## Familias: 21 tipos

| Familia | Piezas | Medidas de referencia | Función de juego |
| --- | --- | --- | --- |
| Rectas | Corta, estándar, larga | Avance de 12, 24 y 40 m | Enlazar, preparar y acelerar |
| Curvas abiertas | 90° izquierda / derecha | Radio 40 m | Mantener velocidad y sostener un derrape |
| Curvas medias | 90° izquierda / derecha | Radio 24 m | Preparar la entrada y cambiar de apoyo |
| Curvas cerradas | 90° izquierda / derecha | Radio 12 m | Precisión en una esquina compacta |
| Horquillas | 180° izquierda / derecha | Radio 12 m | Retorno y salida lenta, sin invertir el control |
| Enlaces diagonales | 45° izquierda / derecha | Radio 24 m | Abrir diagonales y variar las combinaciones |
| Chicane | Enlace de dos apoyos | Avance 40 m; desplazamiento lateral suave | Anticipación y contravolante; sale sobre el eje original |
| Peraltes | 90° izquierda / derecha | Radio 24 m; hasta 8° de inclinación lateral | Apoyo distinto con entrada y salida sin peralte |
| Rampa ascendente | Subida | +6 m en 28 m de avance; pendiente máxima 34% | Cambiar de nivel con transiciones suaves |
| Tablero de puente | Recta estructural | 24 m; espesor 0,65 m; cota mínima 6 m | Cruzar sobre otro tramo; apoyos fuera del carril inferior |
| Rampa descendente | Bajada | −6 m en 28 m de avance | Volver al nivel anterior y recuperar velocidad |
| Badenes | Tres ondulaciones | 30 m; altura de 0,32 m | Relieve físico y cambios de carga |
| Cresta de salto | Una cresta | 16 m; altura de 1,4 m | Despegue y aterrizaje según velocidad |

Las medidas de avance se refieren a la base de la pieza. El banco muestra también la longitud recorrida sobre su superficie. Los radios se miden sobre el centro de la calzada.

## Reglas de montaje y jugabilidad

- Para probar una vuelta, el último conector debe coincidir con el primero en planta, altura y orientación. Las tolerancias son 8 cm, 3 cm y aproximadamente 0,17°.
- Los cruces deben tener al menos 4 m entre superficies. El ejemplo a cota 6 m deja 5,35 m hasta la cara inferior del tablero.
- Dos corredores que se solapan a la misma altura no constituyen un montaje válido. El banco también rechaza piezas bajo la cota inicial, pendientes superiores al 36% y radios que doblarían los bordes de la carretera.
- El coche conserva el tramo por continuidad de recorrido y altura. Pasar bajo un puente no lo traslada al tramo superior ni adelanta puertas de vuelta.
- En una cresta, el coche pierde contacto si el apoyo ya no puede seguir su trayectoria. Durante el vuelo conserva inercia y tiene menos autoridad de dirección; aterriza sobre la superficie de su propio tramo. El aterrizaje reduce ligeramente la velocidad según su intensidad.
- La cámara sigue la altura de forma amortiguada. No se añade una sacudida artificial a badenes o aterrizajes. Un indicador de posición mantiene legible el paso bajo un puente.
- Para los primeros montajes de salto, se deja una recta de recepción antes de la siguiente curva.

## Banco 3D dentro del prototipo

Abrir **Tramos** en la barra superior. La biblioteca muestra cada tipo a escala, con el truck original como referencia, sus medidas y sus conectores: verde es entrada y ámbar salida. Arrastrar permite girar y la rueda o el pellizco acercan la vista.

**Añadir al montaje** coloca la pieza en el último conector. **Nuevo montaje** empieza una secuencia vacía. Se puede quitar el último tramo, deshacer cambios y seleccionar un tramo de la secuencia para inspeccionarlo de cerca. **Mi montaje** recupera la vista completa. El borrador se guarda localmente y admite hasta 32 tramos. **Probar montaje** abre entrenamiento cuando las conexiones y el espacio libre son válidos.

Se incluyen tres montajes cerrados:

1. **Club técnico:** dos horquillas y dos chicanes, aproximadamente 256 m.
2. **Ocho elevado:** cruce a dos alturas con subida, tablero y bajada, aproximadamente 539 m.
3. **Rally de crestas:** badenes, salto, recepción recta, curvas medias y chicane, aproximadamente 354 m.

Los tres coches completan los tres montajes con entradas digitales de izquierda/derecha en las pruebas de simulación. Son montajes de entrenamiento con récords separados; el campeonato y sus desbloqueos se conservan.

## Datos y extensión

`src/track-pieces.js` contiene el catálogo, el muestreo y el compilador. Los montajes son listas ordenadas de identificadores o de piezas con parámetros explícitos. Por ejemplo, `{ id: 'ramp-up', length: 48, rise: 6 }` crea una subida más larga y suave con el mismo contrato de conexión. Cambiar los parámetros genera una identidad distinta para los récords del montaje.

`src/circuit.js` adapta esos datos a un recorrido continuo; `src/road-geometry.js` produce calzada, tablero y apoyos compartidos entre banco y juego. `src/physics.js` resuelve altura, contacto, vuelo y aterrizaje. `src/track-workbench.js` permite inspeccionar y combinar las piezas.
