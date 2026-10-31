# RoadRushers · propuesta de meta y experiencia móvil

Dirección para la siguiente fase. Pistas, entornos, colección y entrenamiento están implementados; la economía, el matchmaking online y la nueva navegación de este documento son propuestas para validar.

## Identidad

Carreras de miniaturas que se dominan con dos controles, partidas cortas y una colección que invita a volver. La profundidad está en preparar curvas, frenar, cambiar apoyos, recuperar derrapes y elegir coche/neumático para cada prueba.

Golf Clash ofrece una referencia para progresar por tours y emparejar por trofeos. Su soporte describe ambas funciones de los trofeos. [Fuente oficial](https://playdemic.helpshift.com/hc/en/6-golf-clash/faq/446-what-are-trophies/?contact=1&f=how-does-matchmaking-work-in-golf-clash&l=en&p=web&s=matchmaking).

Gran Turismo ofrece referencias para colección, dominio y competición por clases. Su documentación presenta el nivel de coleccionista, las carreras Sport y las licencias. [Colección](https://www.gran-turismo.com/us/gt7/manual/option/01), [Sport](https://www.gran-turismo.com/us/gt7/manual/sportmode/01), [licencias](https://eu.gran-turismo.com/us/gt7/news/00_5630146.html).

## Bucle de sesión

1. Elegir una prueba con circuito, clase y condiciones en una ficha.
2. Elegir coche elegible y revisar neumáticos y comportamiento esperado.
3. Competir durante 45–90 segundos.
4. Ver posición, diferencia con el objetivo y una recompensa comprensible.
5. Progresar hacia la siguiente licencia, colección o personalización.

Los duelos de una vuelta pueden comenzar con IA y posteriormente ghosts verificados. Parrillas y copas de varias vueltas amplían la sesión. El sistema online requiere validar resultados y versiones de circuito antes de conceder trofeos.

## Progresión

| Eje | Qué mide | Qué abre |
| --- | --- | --- |
| Licencia | Curva, freno, derrape, terreno y desniveles | Pruebas y clases más exigentes |
| Colección | Coches y familias descubiertas; objetivos por época | Coches, fichas y cosméticos |
| Competición | Resultados y consistencia en series/tours | Divisiones y distinciones de temporada |

Los nueve entornos organizan series: Club, Bosque, Mediterráneo, Desierto, Invierno, Pirineos, Reunión, Tokio y Bund. Una serie puede contener varias rutas y condiciones. La biblioteca modular permite crear tanto pruebas breves de licencia como circuitos completos.

La clase del coche debe resumir su potencial y limitar las mejoras admitidas. Motor, transmisión, neumáticos y suspensión se ensayan por clases. Conviene validar cinco familias de comportamiento antes de construir cincuenta árboles de mejoras.

La economía inicial puede usar créditos por participar y completar objetivos, más premios de colección por hitos. Los costes y ritmos de desbloqueo se fijan después de medir sesiones y repetición. Pintura, wrapping, llantas, lunas y trails forman la capa de expresión. El acceso actual de prueba a los coches de taller debe conservarse al migrar a una colección progresiva.

## Interfaz móvil

Cuatro entradas persistentes: **Carrera, Garaje, Circuitos, Perfil**. Carrera presenta una acción principal para continuar o competir, la ficha de prueba y el coche elegido. Sonido y cámara viven en un menú breve; el editor y la dirección de arte se abren desde Circuitos.

El flujo habitual debe llegar a la salida en dos decisiones: prueba y coche. Clase, clima, rivales y recompensa se leen juntos. Después, la acción principal es revancha o siguiente prueba; los premios se agrupan en una pantalla.

El Garaje necesita filtros por familia, época, clase y disponibilidad, favoritos y comparación entre dos coches. El detalle presenta la miniatura y su comportamiento. Personalización y mejoras tienen entradas propias, vista previa y acciones para aplicar o revertir.

En carrera se priorizan carretera, posición y objetivo. Los controles táctiles necesitan áreas cómodas para ambos pulgares, área segura y pulsación simultánea fiable para frenar. Tiempos, mapa y velocidad se distribuyen por orientación sin cubrir la salida de una curva. Los controles principales deben tener al menos 44 px y funcionar sin hover.

El editor necesita búsqueda, selección clara, inserción/reordenación y validación visible. El estudio de entornos usa hoja inferior en vertical y panel lateral en horizontal, con cámara libre.

## Orden de validación

Primero, cerrar y conducir las rutas y medir los nueve entornos. Después, probar licencia → carrera → recompensa → garaje en móvil. Con ese recorrido validado, definir economía, divisiones y temporadas.

Medir tiempo hasta la primera salida, finalización, reinicios, comprensión del frenado, duración y repetición de sesión, cambio de coche, éxito al encontrar personalización y estabilidad de FPS en una muestra de móviles físicos.
