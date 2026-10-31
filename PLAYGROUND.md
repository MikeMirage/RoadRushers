# Pruebas de gameplay

La pantalla de entrada prepara una sesión de entrenamiento o una carrera local con IA. Todos los coches se eligen libremente en el garaje 3D, incluidos el Evo y el Cobra originales. Elegir otro coche conserva las condiciones pendientes. Las copas, medallas y desbloqueos no participan en este flujo y sus guardados anteriores no se modifican.

Desde la configuración se eligen circuito, superficie, clima, entorno, anchura, ritmo y cámara. La carrera añade número de coches, vueltas, dificultad, variedad de niveles e interacción ghost/contacto. El catálogo reúne los circuitos originales, todos los presets modulares y el montaje actual del editor. Las anchuras que invalidan la geometría se desactivan. La última selección se guarda con una clave independiente de la carrera.

## Móvil

- La mitad inferior izquierda completa gira a la izquierda.
- La mitad inferior derecha completa gira a la derecha.
- Dos dedos, uno en cada zona, mantienen el freno progresivo.
- Pasar un dedo de una mitad a otra cambia la dirección. Sacarlo de la mitad inferior libera su control.
- Pausar, girar la pantalla, perder la captura o cancelar el gesto libera los controles.

Las zonas son transparentes y no tienen botones dibujados. Durante la cuenta atrás aparece una indicación breve; en gameplay quedan tiempo, vuelta, posición en carrera y pausa. La pausa permite reiniciar o volver al configurador. El mismo diseño funciona en vertical y horizontal. El teclado conserva flechas/A-D y frenada combinada.

`src/input.js` centraliza teclado y multitouch. Sus tests comprueban límites de las zonas, dos dedos, cruces, cancelaciones y liberación de captura. Los tests de configuración comprueban acceso a todos los coches, conservación de condiciones y separación de los guardados de progresión.

## Después de la sesión

Las carreras abren automáticamente los tiempos de vuelta, el récord local y el total al cruzar meta. Desde la pausa se puede finalizar un entrenamiento o retirarse y consultar las vueltas completadas. La pestaña Top 50 ofrece referencias ficticias marcadas como estimación IA. Ver [resultados y ranking provisional](RESULTS_AND_RANKINGS.md).
