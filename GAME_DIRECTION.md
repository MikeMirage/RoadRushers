# RoadRushers · propuesta de meta y experiencia móvil

Dirección para la siguiente fase. Pistas, entornos, colección y entrenamiento están implementados; la economía, el matchmaking online y la nueva navegación de este documento son propuestas para validar.

## Identidad

Carreras de miniaturas que se dominan con dos controles, partidas cortas y una colección que invita a volver. La profundidad está en preparar curvas, frenar, cambiar apoyos, recuperar derrapes y elegir coche/neumático para cada prueba.

Golf Clash ofrece una referencia para progresar por tours y emparejar por trofeos. Su soporte describe ambas funciones de los trofeos. [Fuente oficial](https://playdemic.helpshift.com/hc/en/6-golf-clash/faq/446-what-are-trophies/?contact=1&f=how-does-matchmaking-work-in-golf-clash&l=en&p=web&s=matchmaking).

Gran Turismo ofrece referencias para colección, dominio y competición por clases. Su documentación presenta el nivel de coleccionista, las carreras Sport y las licencias. [Colección](https://www.gran-turismo.com/us/gt7/manual/option/01), [Sport](https://www.gran-turismo.com/us/gt7/manual/sportmode/01), [licencias](https://eu.gran-turismo.com/us/gt7/news/00_5630146.html).

## Bucle de sesión

1. **Circuito.** Elegir el trazado sobre una imagen inspirada en ese circuito, con su silueta protagonista. Continuar con «Elegir reglas».
2. **Reglas.** Elegir modo, vueltas, parrilla, dificultad, contacto y categoría de coches. Continuar con «Elegir coche».
3. **Coche.** Elegir entre las miniaturas compatibles con las reglas anteriores en una cuadrícula de tarjetas. Cada tarjeta presenta el coche y su nombre; la selección tiene contorno azul claro y confirmación visible. «Salir a pista» aparece al final de este paso. La personalización tiene su entrada propia en el Garaje.
4. Competir durante 45–90 segundos.
5. Ver posición, diferencia con el objetivo y una recompensa comprensible.
6. Progresar hacia la siguiente licencia, colección o personalización.

El orden **Circuito → Reglas → Coche** lo fija el usuario el 2 de noviembre de 2026. Las pantallas se diseñan primero para vertical, entre 9:16 y 1:2. Los mockups actuales del recorrido están en [circuito](art/ui-references/race-flow-portrait-2026-11-02/01-circuito.png), [reglas](art/ui-references/race-flow-portrait-2026-11-02/02-reglas.png) y [coche en tarjetas](art/ui-references/garage-studio-2026-11-02/02-coche-carrera.png). Este último sustituye la propuesta anterior de un solo coche protagonista para entrar en carrera.

La nueva regla **Categoría de coches** admite sin restricción, origen (por ejemplo, japoneses), mismo modelo que el jugador y clases de potencia. La categoría filtra los coches del tercer paso. «Mismo modelo» se resuelve después de elegir el coche: todos los rivales usarán ese modelo. Las clases P1/P2/P3 están implementadas como grupos de rendimiento del catálogo (Ligera, Sport y Alta), con asignación explícita por modelo. No representan umbrales de CV ni deducen caballos de la barra de velocidad. El origen debe catalogarse por coche: la colección «Japón & rally» incluye coches de otros países y no equivale al filtro «Japoneses».

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

Cuatro entradas persistentes: **Carrera, Garaje, Circuitos, Perfil**. El inicio presenta la miniatura 3D en el mismo estudio gris azulado del garaje, el circuito resumido y una única acción «Jugar». El modo Entrenamiento/Carrera IA se elige en Reglas. Sonido y cámara viven en un menú breve; el editor y la dirección de arte se abren desde Circuitos.

El flujo habitual llega a la salida en tres decisiones ordenadas: circuito, reglas y coche. Las reglas determinan qué coches son elegibles; circuito y reglas se resumen en el último paso. Después, la acción principal es revancha o siguiente prueba; los premios se agrupan en una pantalla.

El **Garaje** es un estudio para explorar y personalizar la colección. El usuario elige una categoría y encuentra todos sus coches desbloqueados en una fila horizontal continua. En vertical se ve el elegido centrado y parte de los vecinos; flechas laterales y gesto horizontal desplazan la fila hasta centrar el siguiente modelo, manteniendo el encuadre y la iluminación. El fondo es difuso, en grises y azules, con luz principal suave, luz de relleno y luz de contorno que separa la miniatura del fondo. El nombre, tres índices de serie sobre 10 y la acción «Personalizar» quedan bajo el escenario. Los coches iniciales tienen índices alrededor de 3–5/10; las mejoras mecánicas todavía no existen y los coches de fábrica conservan margen. Cada modelo tiene un perfil propio de conducción. La selección interpola el desplazamiento de la fila y una pequeña rotación del coche, junto con las cifras y barras; respeta la preferencia de movimiento reducido. El [mockup de estudio](art/ui-references/garage-studio-2026-11-02/01-garaje-estudio.png) sustituye la propuesta anterior de taller con pedestal y miniaturas en una tira de botones. Personalización y mejoras tienen entradas propias, vista previa y acciones para aplicar o revertir.

La **elección de coche para carrera** es una vista distinta: cuadrícula de dos columnas en vertical, con tarjetas de todos los coches elegibles según las reglas ya elegidas. Resume circuito, reglas y categoría, permite recorrer la lista verticalmente y mantiene «Salir a pista» accesible con el coche seleccionado. El recorrido de tres pasos sustituye aquí la navegación global. La referencia aportada para las tarjetas se conserva en [selección de Gran Turismo](art/ui-references/garage-studio-2026-11-02/00-referencia-tarjetas.png). Ambas vistas y el recorrido Circuito → Reglas → Coche están implementados. Las tarjetas se generan a partir del mismo modelo 3D y la personalización usados en carrera.

La selección de circuito prioriza el trazado real grande sobre fondo neutro, distancia, país/región y previsión; los fondos individuales dejan de ser necesarios. La iconografía sustituye etiquetas repetidas, conservando nombres accesibles, tooltips y las acciones principales. Los desplegables comparten fuente DM Sans de 14 px, filas de al menos 44 px, navegación por teclado y estados rosa/azul.

En carrera se priorizan carretera, posición y objetivo. El jugador se identifica con un arco trasero fino y tenue a ras de carretera, oculto por la carrocería cuando corresponde. Los rivales muestran nombres pequeños sobre el coche, con descarte por distancia, fuera de pantalla y solapamiento. Los controles táctiles necesitan áreas cómodas para ambos pulgares, área segura y pulsación simultánea fiable para frenar. Tiempos, mapa y velocidad se distribuyen por orientación sin cubrir la salida de una curva. Los controles principales deben tener al menos 44 px y funcionar sin hover.

El editor necesita búsqueda, selección clara, inserción/reordenación y validación visible. El estudio de entornos usa hoja inferior en vertical y panel lateral en horizontal, con cámara libre.

## Dirección visual de las próximas fases

El usuario aporta cuatro capturas de Gran Turismo como referencia estética para la evolución del juego (2 de noviembre de 2026). Se conservan los originales en `art/ui-references/gran-turismo/`. La identidad de PRL sigue siendo **rosa y azul claro sobre gris carbón**. Just Roll orienta la legibilidad y transparencia del HUD; estas capturas de Gran Turismo orientan la composición de menús, pruebas, competición y garaje.

| Referencia aportada | Aplicación prevista en PRL |
| --- | --- |
| [01 · Eventos de circuito](art/ui-references/gran-turismo/01-eventos-circuito.png) | Circuito de fondo, fichas de prueba en una fila y accesos de modo en la zona inferior. |
| [02 · Selección de pruebas](art/ui-references/gran-turismo/02-seleccion-pruebas.png) | Tarjetas verticales con imagen protagonista; requisitos arriba y resultado/recompensa abajo, siempre en posiciones consistentes. |
| [03 · Garaje y showroom](art/ui-references/gran-turismo/03-garaje-showroom.png) | Fila horizontal de miniaturas 3D en un estudio gris azulado con fondo difuso, selección centrada y controles de personalización debajo en vertical. |
| [04 · Competición](art/ui-references/gran-turismo/04-competicion-fichas.png) | Fichas comparables con trazado superpuesto, clase grande, circuito y datos de sesión alineados. |

Criterios de composición extraídos de las imágenes para los siguientes diseños:

- **El coche y el circuito construyen la pantalla.** Fondos 3D o capturas del juego con encuadres cuidados; paneles oscuros y degradados sostienen la lectura sobre la imagen.
- **Jerarquía tranquila y precisa.** Texto blanco y gris, separadores finos, pocos bordes y aire entre grupos. Reservar las cifras grandes para clase, posición, tiempo y otros datos decisivos; usar etiquetas secundarias discretas y legibles.
- **Color con una función clara.** Rosa para acción principal y énfasis; azul claro para información y estados. Mantener grandes superficies neutras y evitar teñir todos los paneles.
- **Fichas que se puedan comparar.** Requisitos, vueltas, circuito, resultado y recompensa ocupan el mismo lugar entre pruebas. Mostrar cada dato cuando exista el sistema que lo respalda.
- **Navegación estable.** Barra de contexto compacta arriba y acciones principales abajo, con icono y etiqueta. La selección tiene un contorno o cambio de fondo inequívoco.
- **Garaje de colección.** Presentar las miniaturas en una fila horizontal, con materiales, sombras, luz de contorno y relleno que den presencia al objeto; mantener la selección centrada y la personalización accesible. La cuadrícula de tarjetas corresponde a elegir coche para carrera.
- **Adaptación móvil.** Mantener esta jerarquía con carrusel de fichas y acciones alcanzables; evitar trasladar el texto diminuto de las capturas a pantallas pequeñas. Conservar controles de al menos 44 px.

Esta dirección se aplicará al desarrollar las pantallas de pruebas, progresión y colección previstas en este documento, conservando la identidad y las proporciones de miniatura de PRL.

## Ritmo de conducción

La punta de los tres coches iniciales a ritmo Ágil y asfalto seco es de aproximadamente **146, 149 y 158 km/h** (velocidad física, no un multiplicador del velocímetro). Tierra, grava, hielo y barro conservan sus diferencias de ritmo y agarre. Por encima de 108 km/h el giro máximo se hace progresivo, manteniendo la respuesta y el contravolante. La IA anticipa la distancia de frenada y puede mantener el giro durante ella. Las referencias de tiempos usan una versión nueva de física; los datos anteriores permanecen guardados.

## Orden de validación

Primero, cerrar y conducir las rutas y medir los nueve entornos. Después, probar licencia → carrera → recompensa → garaje en móvil. Con ese recorrido validado, definir economía, divisiones y temporadas.

Medir tiempo hasta la primera salida, finalización, reinicios, comprensión del frenado, duración y repetición de sesión, cambio de coche, éxito al encontrar personalización y estabilidad de FPS en una muestra de móviles físicos.
