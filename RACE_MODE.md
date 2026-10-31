# Carreras con IA · prototipo de parrilla

Desde **Carrera IA** en la pantalla principal, o **Competir contra IA** en el briefing de entrenamiento, se configura una carrera local. El coche del jugador se elige en el garaje y los rivales utilizan ese mismo modelo y clase.

## Opciones para comparar

- **4, 8 o 12 coches en total**, incluido el jugador. El valor inicial es 12.
- **Ghosts:** los coches se atraviesan. La IA sigue su propia trazada y no modifica la velocidad del jugador al coincidir con él.
- **Con contacto:** los coches tienen volumen, se bloquean, desplazan y transfieren impulso. La IA busca un carril libre o frena ante un coche más lento.
- **1, 3 o 5 vueltas.** Por defecto, tres vueltas.
- **Dificultad IA: Novato, Club o Experto.** Cambian la anticipación, el margen de frenada, la velocidad que intentan llevar por curva y las oportunidades que aprovechan para adelantar o defender. El valor inicial es Club.
- **Parrilla variada o uniforme.** La variada mezcla niveles cercanos a la dificultad elegida, con predominio del nivel principal. La uniforme mantiene a todos en ese nivel. Los pilotos conservan pequeñas diferencias de confianza y trazada, y su nivel aparece junto a su apodo en la clasificación.
- **Anchura base original, 12, 14 o 16 m.** Se conservan los estrechamientos del trazado. Las anchuras que doblarían una curva o solaparían tramos se desactivan.
- Los tres circuitos de la copa, los tres montajes modulares y el montaje actual del usuario pueden utilizarse como recorrido.

La parrilla tiene dos columnas escalonadas; el jugador sale al fondo. Las posiciones se calculan con progreso continuo y controles de paso ordenados. Cruzar la meta desde la parrilla inicia la primera vuelta, no la completa. La altura evita contactos entre las dos carreteras de un puente.

## Rivales

Los apodos y colores identifican rivales simulados, señalados como **IA**. Todos usan exactamente el mismo perfil de vehículo, motor, aceleración, agarre, respuesta de dirección, frenos, superficies, saltos y límites de pista que el jugador. No existe un multiplicador de velocidad por habilidad. Un controlador solo lee el estado de la carrera y entrega dirección, entre −1 y 1, y freno al `DriveModel` común.

La dirección es gradual, con velocidad de cambio limitada. La referencia de trazada se desplaza lentamente y el control amortigua la velocidad de giro del coche, anticipando la curvatura y la deriva. La geometría se consulta en una guía compartida por la parrilla. La frenada se prepara mirando hasta 48 m por delante, incluyendo cambios de superficie y pendientes. Frenar conserva el mismo bloqueo de dirección del jugador; la IA necesita preparar la entrada antes de girar.

Con contacto, el piloto calcula el espacio y el cierre de distancia con los coches cercanos. Elige un lado libre, lo mantiene durante el adelantamiento y regresa gradualmente a su trazada después de superarlo. Si no cabe el pase, frena y sigue al coche anterior. Al defender hace un único movimiento anticipado por ataque y conserva su carril cuando un coche se pone a su lado; no persigue cada cambio lateral del atacante. Los ghosts compiten por ritmo y no realizan estas maniobras de bloqueo.

No hay corrección de posición ni velocidad en función de la distancia al jugador. La semilla de la parrilla se conserva al repetir, para comparar ghosts, contacto, número de coches y anchuras en condiciones reproducibles.

El contacto usa cápsulas sobre los ejes de los coches y una respuesta poco elástica. En los modelos con dimensiones de diseño se usan su anchura y longitud. Los contactos se limitan a coches próximos en altura; los guardarraíles cancelan el impulso hacia fuera de la pista. Los rivales terminados siguen circulando hasta que llega el jugador.

## Lectura y resultado

- Un aro verde identifica al jugador dentro del grupo.
- El HUD muestra posición, vuelta, tiempo total y rivales próximos; el minimapa incluye los coches.
- Los rivales encienden los pilotos traseros y el halo simulado cuando frenan.
- El resultado fija la posición del jugador al cruzar su meta. Muestra el orden en ese momento y marca **En pista** a los rivales que todavía no han terminado.
- **Revancha** repite la misma parrilla; **Cambiar parrilla** abre la configuración.

Este modo es una prueba independiente de carrera. La copa de iniciación conserva sus pruebas oficiales y medallas. Los récords de entrenamiento conservan una identidad distinta para los recorridos modificados de anchura.

## Render e integración del catálogo

`src/rival-fleet.js` usa instancias de cada pieza del modelo: ampliar de 4 a 12 coches aumenta las instancias, no las llamadas de dibujo por carrocería. Las ruedas y la dirección se animan por coche. El material de pilotos traseros recibe una intensidad por instancia; los halos comparten textura y una única llamada de dibujo. Los rivales no añaden luces ni sombras dinámicas.

Los rivales usan la apariencia de serie del modelo y sus propios colores, conservando la personalización del jugador en su coche. El contrato del modelo es `{ group, wheels, frontWheels, brakeMaterials?, brakeRearZ? }`. Se utiliza `exterior-paint` para las variaciones de color, y `vehicle.design.width` / `halfLength` para las dimensiones cuando existen. La selección del coche sigue pasando por el garaje.

Los tests de carrera cubren parrillas, reproducibilidad, ghosts, contacto, muros, puentes, vueltas, anchuras válidas, todos los trazados y los tres coches originales. Los tests de conducción IA verifican la suavidad de la dirección, diferencias de ritmo, adelantamiento sin contacto, seguimiento en pista estrecha y defensa sin cambios repetidos de lado. Una reproducción de sus mandos en un `DriveModel` de jugador obtiene exactamente el mismo movimiento, también en lluvia. El render mantiene el mismo número de lotes al pasar de cuatro a doce participantes.
