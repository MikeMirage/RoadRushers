# Resultados y referencias provisionales

Al terminar una carrera se muestran todas las vueltas, la mejor vuelta de esa sesión, el récord personal de vuelta y el tiempo total. La vuelta 1 incluye la salida desde la parrilla. Cada cruce de meta se interpola dentro del paso de física y la suma de las vueltas coincide con el total. La pausa no suma tiempo.

Desde la pausa también se puede finalizar un entrenamiento o retirarse de una carrera. La vuelta parcial se indica por separado y no puede convertirse en récord de vuelta; una retirada no registra un récord total de carrera.

Los récords son locales al navegador. Se separan por geometría de pista y anchuras, coche y parámetros de conducción, superficie, clima, ritmo, modo, número de coches e interacción. El récord de vuelta puede compararse entre carreras de diferente longitud; el total se separa por número de vueltas. Los ajustes de pintura, cámara y decorado no crean categorías nuevas. La versión de física forma parte de la identidad del registro.

## Top 50 mundial provisional

La pestaña **Top 50** dice explícitamente **PROVISIONAL · ESTIMACIÓN IA**. Sus pilotos y tiempos son ficticios, y no se consultan servidores ni resultados de personas reales. La fila del jugador utiliza su récord local real. Si queda fuera de las cincuenta primeras filas se muestra también por separado.

Un Web Worker conduce nueve pilotos de distintos niveles con el `DriveModel` compartido y calcula vueltas en pista libre, con el mismo coche, trazado y condiciones. Se interpolan esas muestras para crear cincuenta referencias estimadas reproducibles. Se puede comparar mejor vuelta o total de carrera. Este cálculo no modifica la carrera del jugador ni adapta las referencias a su rendimiento; trabaja en segundo plano y se cancela al abandonar los resultados. Las referencias recientes se guardan en caché.

`src/leaderboard.js` es el proveedor que habrá que sustituir al conectar un ranking online. Un servicio real deberá validar la versión del juego y el trazado, fijar categorías de competición, verificar resultados y gestionar identidad de jugadores. Este prototipo no publica los récords locales.
