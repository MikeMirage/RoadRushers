# Gráficos y controles

El botón ⚙ del inicio y «Gráficos y controles» en pausa abren los ajustes. Se guardan de forma independiente a coches, circuitos, récords y progresión.

## Gráficos

- Ahorro: automática a 1×, entorno ligero, sin sombras ni posprocesado.
- Equilibrada: automática entre 1,5× y 2×, entorno medio, sombras de 1024 px y MSAA 2×.
- Alta: automática entre 2× y 3×, entorno alto, sombras de 2048 px y MSAA 4×.
- Resoluciones fijas de 1×, 1,5×, 2× y nativa; se limitan a la densidad real de la pantalla y nunca bajan automáticamente.
- Detalle, sombras, MSAA y acabado se pueden cambiar por separado. El panel muestra los píxeles y el factor de renderizado efectivos; MSAA respeta el máximo del dispositivo. Desactivar el acabado omite la corrección de color y conserva el suavizado elegido.

El renderizado y la simulación siguen separados: cambiar calidad durante una pausa conserva el coche, la vuelta y el cronómetro. El garaje y el editor comparten la resolución elegida. La resolución automática solo evalúa la carrera, evitando que abrir menús reduzca la nitidez.

La vegetación geométrica de respaldo se oculta para dejar paso a los modelos detallados. Las palmeras costeras usan el mismo sistema de assets; las masas de roca mantienen su colocación con geometría más suave y material de roca. Si falla una descarga puede haber menos vegetación; no se recuperan los conos de respaldo.

## Controles táctiles

- Dos zonas: se mantiene el control anterior; toda la mitad inferior izquierda o derecha gira en esa dirección. Ambas frenan progresivamente.
- Trackpad analógico: apoyar un dedo comienza en giro cero. El desplazamiento horizontal desde ese punto determina la cantidad de giro, con una zona muerta de 3 px y una curva suave cerca del centro.
- Sensibilidad precisa, equilibrada o rápida. Un indicador transitorio muestra el giro mientras se mantiene el dedo.
- Un segundo dedo dentro de la mitad inferior activa el mismo freno progresivo. Al soltarlo se recupera la dirección del primer dedo; si se suelta el primero, el restante se recentra sin provocar un volantazo.
- Salir de la zona, cancelar el toque, perder captura, pausar, rotar o cambiar modo limpia los controles.

El teclado conserva sus controles. El trackpad usa la misma física; no altera velocidad, agarre, récords ni reglas de carrera.
