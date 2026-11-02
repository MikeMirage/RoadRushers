# PRL · navegación, salidas y celebraciones

Actualización de diseño · 2 de noviembre de 2026. Complementa ECONOMY_V2_PROPOSAL.md. Requisitos de diseño; el [informe de implementación](IMPLEMENTATION.md) recoge las funciones integradas y las comprobaciones realizadas.

El usuario exige que todas las pantallas tengan salida, especialmente en móvil, y solicita popups de recompensa, currency volando a la cartera y celebraciones especiales al desbloquear un coche o conseguir una gran prestación. Se interpreta «alta prestación» como resultado deportivo destacado (récord, victoria importante, ascenso), además de una mejora importante de vehículo.

## Navegación de referencia

Propuesta en conversación: **Events · Career · Drive · Cars · Rankings**. El usuario plantea World Champions; se recomienda Rankings para la etiqueta corta y World Champions como posible nombre de clasificación/competición. La etiqueta final sigue siendo una decisión de diseño, no una funcionalidad implementada.

| Destino | Responsabilidad | Salida |
| --- | --- | --- |
| Events | Copas, torneos, desafíos y futuros eventos temporales | Barra persistente; detalle vuelve a la lista conservando scroll |
| Career | Piloto, XP, licencias, historial, logros y progreso de ligas | Barra persistente; enlaces contextuales a Cars vuelven a su origen |
| Drive | Continuar competición, duelo habitual, carrera libre y entrenamiento | Barra persistente; preparar carrera abre recorrido con Atrás y Cerrar |
| Cars | Colección, garaje, mejoras, personalización y futuro concesionario/ofertas | Barra persistente; ficha vuelve a colección, taller vuelve a ficha |
| Rankings | XP por defecto, competición, récords y colección | Barra persistente; filtros y detalles tienen Atrás/Cerrar |

Drive central y destacado en rosa. Pulsarlo no cobra ni sale directamente a pista. Circuitos y editor se acceden desde Drive; ajustes desde Career/cabecera. No inventar competiciones temporales, ofertas con cuenta atrás ni rankings mundiales en local. Rankings local muestra registros propios y explica el estado del apartado online. XP mide trayectoria, no una clasificación pura de habilidad.

## Contrato universal de salida

Una pantalla raíz no necesita una X que cierre el juego: debe permitir cambiar de destino desde la barra. Toda pantalla subordinada sí tiene **Atrás**; todo modal, hoja inferior, celebración o flujo inmersivo tiene **Cerrar (X)** visible. Nunca depender solo del gesto, del botón físico, de tocar fuera ni de terminar una animación.

- Cabecera fija dentro del área segura, X con área mínima 44×44 px (preferible 48×48) y nombre accesible «Cerrar [nombre]». Separada de la cartera para evitar toques ambiguos.
- Contenido central desplazable; cierre superior siempre visible; acción inferior y «Cerrar»/«Volver» accesibles sin llegar al final de un documento largo. Adaptar a teclado móvil, landscape, safe-area y texto ampliado.
- Atrás retrocede un nivel y conserva selección/scroll. Cerrar sale del flujo al origen registrado. Si se abrió por enlace sin origen, vuelve a su sección raíz. Ningún enlace puede crear un callejón sin salida.
- Escape y navegación Atrás del navegador producen el mismo resultado que el control visible, cerrando primero la capa superior. No crear bucles de historial ni interceptar la salida de la aplicación desde la raíz.
- Solo una capa modal activa, con foco contenido y fondo inerte. Al cerrar, devolver foco al control que la abrió o al título del destino si aquel desapareció. En móvil, bloquear scroll de fondo y restaurarlo después.
- Tocar fuera puede cerrar avisos simples; no confirma compras ni descarta silenciosamente cambios. Deslizar una hoja para cerrarla es un extra, nunca el único mecanismo.

| Contexto | Al cerrar | Confirmación adicional |
| --- | --- | --- |
| Ficha de liga/coche, ranking, detalles | Volver al origen | Ninguna |
| Preparación Circuito → Reglas → Coche | Volver a Drive/evento, conservar borrador; no cobrar | Ninguna |
| Inscripción sin confirmar | Cancelar cotización; no tocar saldo | Ninguna |
| Torneo pagado entre mangas | Guardar y salir, mantener inscripción | Ninguna; no equivale a retirarse |
| Carrera activa | Abrir pausa; ofrecer Continuar y Guardar/salir según política del modo | Advertir solo si la acción explícita abandona y pierde entrada |
| Personalización con cambios sin aplicar | Ofrecer Aplicar / Descartar / Seguir editando | Sí, por cambios pendientes |
| Recompensa o celebración | Omitir presentación y volver al resultado/origen; premio permanece | Ninguna |
| Error de guardado | Cerrar aviso mantiene indicador persistente «Solo esta sesión» | Ninguna; exportar sigue disponible |

La X de un torneo nunca debe llamar a `retireRun`. «Retirarse» es una acción distinta, con consecuencia monetaria explícita. Si una transacción está en curso, cerrar solo desacopla la presentación: no lanza otra ni intenta revertirla. Su resultado llega a un aviso/historial al resolverse.

## Jerarquía de celebración

| Momento | Presentación | Duración orientativa, siempre omisible |
| --- | --- | --- |
| Créditos/cartas habituales | Resumen de resultado con secuencia breve, sin popup por cada recurso | 0,8–1,2 s |
| Victoria de carrera | Hoja de recompensa con posición, premio neto y cartas | 1,2–1,8 s |
| Coche desbloqueado | Revelado protagonista en estudio 3D; nombre, clase y avance de colección | 2–3 s |
| Liga/licencia nueva, victoria de copa/torneo | Trofeo o insignia, logro y nueva posibilidad concreta | 2–3 s |
| Récord personal o medalla mejorada | Tiempo, diferencia con anterior y contexto de reglamento | 1,5–2 s |
| Mejora de vehículo | Realce de pieza/índice antes y después; nivel efectivo en próxima prueba | 1–1,5 s; N5 puede tener revelado especial |

Estos tiempos describen la entrada animada, no obligan a esperar ni auto-cierran el contenido. X y CTA están disponibles desde el primer fotograma interactivo. Continuar resuelve inmediatamente cualquier movimiento pendiente. Nunca secuestrar controles durante conducción para mostrar un premio; esperar al final o a un menú seguro.

**Coche nuevo:** iluminación de contorno y barrido suave sobre el modelo real, pequeña rotación, nombre protagonista y sonido corto propio. Mostrar «Ya está en tu garaje» solo después del comando de desbloqueo exitoso. Tener 10/10 cartas produce «Listo para desbloquear», no un falso regalo de propiedad. CTA «Ver en Cars»; secundaria «Cerrar». No elegir/equipar el coche sin acción del jugador.

**Alta prestación:** récord personal, primera victoria de torneo, nueva medalla o dominio completo pueden celebrarse sin pagar CR adicionales. Usar resultados reales; un récord compara la misma firma de circuito, física, coche/nivel y reglas. Primer registro se llama «Primer registro», no inventar una mejora; nunca afirmar récord mundial en local. Una derrota con cartas recibidas conserva tono sobrio y pérdida neta visible.

## Vuelo de monedas y cartas

1. Liquidar y guardar la recompensa; obtener un recibo único. El efecto no modifica el saldo.
2. Mostrar el premio bruto y, por separado, el neto de la competición. Si entró con 1.240 CR y pagó 100, su saldo ya es 1.140; al ganar vuelan **200 CR de premio** hacia la cartera y termina en 1.340. El resumen dice **+100 CR netos**. No animar +100 sobre 1.140 ni volver a descontar la entrada.
3. Emitir 6–10 fichas CR simbólicas, no una por moneda. Trayectoria corta y curvada hacia el icono real de cartera; llegada escalonada, pulso suave y conteo del valor representado. Sin grandes destellos ni oclusión de X, cifra o CTA. No atribuir valor individual a cada partícula.
4. Las cartas vuelan al contador de ese modelo, nunca a CR; XP al indicador XP si existe. Si el destino no está visible, usar un contador explícito en el resumen; no volar hacia fuera de pantalla ni inventar coordenadas de una cabecera oculta.
5. Si el usuario cierra, cambia de sección, redimensiona, gira el teléfono o la app pasa a segundo plano: terminar/cancelar efectos y representar el saldo real inmediatamente. Ninguna cola puede dejar una cifra antigua al volver.

La cartera puede mostrar interpolación temporal solo mientras esa secuencia está activa; los controles de gasto consultan siempre el estado económico ya confirmado. Un nuevo recibo no debe sobrescribir una animación anterior con un saldo obsoleto: serializar presentaciones o resolver al saldo actual. Al saltar, limpiar partículas, listeners y callbacks, y sincronizar todos los contadores.

## Cola, omisión y persistencia

Una liquidación agrupa CR, XP y cartas en un resumen. Después se presenta, como máximo, una celebración principal: coche adquirido > liga/licencia > torneo > récord > mejora ordinaria. Los otros hitos aparecen en el mismo resumen con acceso al detalle. No encadenar cinco diálogos para una carrera.

No abrir automáticamente el popup de coche si solo está listo para desbloquear. Si el usuario realiza después el desbloqueo, ese comando genera su propia celebración. La cola de presentación usa `receiptId + celebrationKind + entityId`; animar dos veces no puede pagar dos veces. Mantener los hitos importantes no vistos en una bandeja/resumen persistente. Al recargar tras el guardado, mostrar «Recompensas recibidas» sin exigir volver a reclamarlas; el usuario puede consultar el coche desde Cars aunque cierre todo.

X equivale a omitir el conjunto de celebraciones pendientes de esa liquidación, conserva un resumen consultable y no abre inmediatamente otro modal. No hay botón «Reclamar» si el premio ya fue concedido: usar «Continuar», «Ver coche» o «Ver resultado».

## Movimiento, sonido y rendimiento

Respetar `prefers-reduced-motion` y añadir opción «Animaciones de recompensa». En modo reducido: sin vuelos, rotaciones, confeti ni contador animado; número final, resalte estático e información completa. Sonido respeta mute/volumen de efectos; vibración opcional y nunca necesaria para comprender el premio. Evitar destellos rápidos.

Reutilizar el modelo y render del garaje para el coche, sin montar otra escena WebGL completa si la anterior está activa. Efectos DOM/canvas con presupuesto acotado, `pointer-events: none` y duración finita. No ocultar un cierre con un canvas superior. Para lector de pantalla, anunciar una sola vez el resumen final; partículas decorativas ocultas a accesibilidad y sin leer cada incremento del contador.

## Matriz de aceptación previa a implementar

- Inventariar TODAS las rutas, overlays y flujos existentes en `main.js` y módulos UI; comprobar origen, cierre visible, efecto de Atrás y conservación de estado. La revisión de rutas y comprobaciones de interfaz está descrita en el informe de implementación.
- Probar en 320×568, 390×844 y landscape 844×390; safe areas, teclado abierto, texto al 200 %, scroll largo y reducción de movimiento. Ninguna X/CTA queda fuera del viewport sin alternativa accesible.
- Abrir cada ruta desde al menos dos orígenes y cerrar: vuelve al correcto, conserva selección y foco; una ruta directa sin historial tiene fallback.
- Pulsar X, Escape, Atrás y CTA durante cada fase del vuelo: saldo/cartas idénticos, ninguna repetición ni botón bloqueado.
- Recargar entre guardado y celebración; premio presente exactamente una vez y logro consultable. Dos recibos seguidos no regresan visualmente la cartera a un saldo antiguo.
- Cerrar torneo pagado conserva inscripción; retirada explícita informa pérdida. Cerrar cotización no cobra. Descartar pintura requiere decisión y no gasta CR.
- Derrota: no confeti de victoria ni monedas entrantes si bruto es cero. Empate: devolución correctamente etiquetada. Récord sin premio: no vuelo CR.
- Coche listo y coche poseído tienen textos/acciones distintos. Límites de nivel y récords son los realmente aplicados a la carrera.

## Mockup complementario

[Recompensa, coche desbloqueado y récord](../../art/ui-references/economy-2026-11-02/03-celebraciones.png). Instantáneas de intención visual, no animaciones ejecutables. El vuelo CR se representa mediante trayectoria/fichas; duraciones, cancelación y accesibilidad los define este documento. Las dos primeras láminas preceden a la nueva barra y al cierre universal; no son referencia definitiva de navegación.
