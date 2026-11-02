# PRL · economía y progresión local v2

**Propuesta de diseño · 2 de noviembre de 2026. Implementación autorizada posteriormente por el usuario.**

Véase [implementación, cambios de balance y validación](IMPLEMENTATION.md) para el estado activo; este documento conserva la propuesta de partida.

El usuario confirma que esta fase termina en diseño y mockups. La implementación queda para después de revisar esta propuesta. Los importes son hipótesis de balance; no son datos de retención ni resultados de pruebas con jugadores.

## 1. Decisión de producto

El núcleo es **competir → ganar créditos y cartas → completar un coche → ampliar la colección → abrir una liga → competir por premios mayores**. La conducción debe seguir decidiendo la carrera. La colección da variedad, objetivos y acceso; las mejoras aportan una ventaja pequeña y acotada por reglamento.

Se propone una economía de una moneda, CR, sin valor real. Cartas por vehículo y dominio por liga son progresión, no monedas intercambiables. Sin energía, reparaciones, neumáticos consumibles, gemas, compras reales ni esperas obligatorias en esta fase. Las recompensas se conceden al terminar; la animación de apertura no condiciona el guardado.

Tomamos de Golf Clash la relación entre cartas específicas, equipamiento y tours de mayor nivel. Su documentación oficial confirma cartas por palo y obtención en cofres, y trofeos que abren tours y sirven al emparejamiento. No importamos sus cifras ni suponemos que sus reglas actuales sean adecuadas para carreras contra IA. [Cartas, Playdemic](https://playdemic.helpshift.com/hc/en/6-golf-clash/faq/451-how-do-i-upgrade-my-clubs/?p=web); [trofeos y tours, Playdemic](https://playdemic.helpshift.com/hc/en/6-golf-clash/faq/446-what-are-trophies/).

**Diferencia deliberada:** el dominio local no baja al perder. El riesgo lo asume la cartera; no conviene castigar también el acceso y la colección. Un futuro rating competitivo será independiente de este dominio permanente.

## 2. Auditoría de lo que existe

Revisados `GAME_DIRECTION.md`, `LEAGUE_ECONOMY.md`, `VEHICLE_COLLECTION.md`, `src/league.js`, `src/league-ui.js`, `src/league.css`, integración en `src/main.js`, catálogo, clases, rendimiento y `tests/league.test.js`.

| Sistema | Estado actual comprobado | Cambio propuesto |
| --- | --- | --- |
| Inicio | 600 CR, Truck Classic y Bambino, importación de posesiones antiguas | Conservar saldo inicial y propiedad heredada |
| Coches | Compra directa, precio según índice del catálogo y P1/P2/P3 | Cartas por modelo; desbloqueo gratuito al completar |
| Carrera libre | 130–240 CR por carrera | 80–140 CR; circuito homologado y recompensa visible |
| Licencias | XP + podio Club/Sport | Conservar las tres licencias, separar dominio y colección |
| Copas | Premios por manga + premio final + regalos | Copas de licencia gratuitas con premios reducidos; regalo completo sustituido por contrato de cartas en perfiles nuevos |
| Torneos | Entrada 200/500; todos los finalistas recuperan entrada, además de premios por manga | Entrada con pérdida posible; pago final único y neto explícito |
| Guardado | `prl.league.v1`, transacciones de un snapshot, tokens por intento | Migración v2 y contrato de comandos/recibos versionado |
| Mejoras | No existen; índices de fábrica ya tienen margen | Cinco niveles, límites por liga, ajustes medidos en física |
| UI | Inicio/Carreras/Garaje/Perfil en código | Nueva propuesta: Events/Career/Drive/Cars/Rankings; ver contrato de navegación |
| Taller | Documentación promete pruebas de colección; `main.js` restringe selección y garaje a poseídos | Ruta explícita de préstamo sin recompensas ni propiedad |

Hay 54 entradas actuales en `VEHICLES`: 50 de colección y cuatro bases/especiales. No usar «50» como longitud de inventario ni derivar rareza de la posición del array. No confundir colección, origen, clase de potencia y afinidad de terreno.

La validación actual evita cobros repetidos por token y tiempos inválidos, pero no verifica autoritativamente una carrera ni protege de editar almacenamiento. El diseño nuevo no debe presentarse como sistema antifraude.

## 3. Recursos y reglas universales

| Recurso | Entra por | Sale por | Regla |
| --- | --- | --- | --- |
| CR | Carrera libre, premios, hitos únicos | Entradas y mejoras | Entero no negativo; premio bruto y resultado neto separados |
| Cartas de modelo | Contratos, carreras homologadas, premios de evento | Desbloqueo y niveles | No se venden por CR; sin mercado entre jugadores |
| Dominio de liga | Finalizar duelos de esa liga, 12 al ganar / 6 al perder | No se gasta | Tope por liga; desbloqueos permanentes |
| XP/licencia | Pruebas de habilidad y copas | No se gasta | No vender acceso ni subir por compra |
| Colección | Modelos distintos poseídos | No decrece | Dos pinturas del mismo modelo no cuentan como dos coches |

El jugador nuevo empieza con 600 CR y dos coches P1. Un duelo Club cuesta 100 CR: seis entradas disponibles. La UI recomienda una reserva de cinco entradas de la liga elegida, pero permite entrar con saldo suficiente. No sube automáticamente al jugador a una apuesta mayor al abrir una liga.

## 4. Cartas: objetivos que el jugador puede perseguir

### Catálogo y desbloqueo

Tres bandas de adquisición: **Serie (10 cartas), Especial (20), Icono (40)**. No equivalen a P1/P2/P3 ni prometen mayor velocidad. Cada modelo tendrá `acquisitionBand`, `firstLeague`, `unlockCards` y fuentes explícitas. Los dos coches iniciales ya están poseídos a N1, sin descontar cartas.

Al llegar al umbral aparece «Desbloquear coche», sin coste CR; consume las cartas del umbral y conserva excedentes. No se conceden variantes estadísticas aleatorias del mismo modelo. La propiedad es permanente. Ver una carta descubre la ficha, pero no concede propiedad ni permite inscribirse con ese coche.

**Colección objetivo:** elegir un modelo de las ligas ya abiertas. Cada carrera homologada terminada concede 2 cartas dirigidas, gane o pierda. Carrera libre homologada también concede 2; editor, taller, reinicios, abandono y piloto de QA no pagan. Se fija objetivo y recompensa al iniciar el intento; cambiar de objetivo durante la carrera no cambia su recibo.

Primer contrato: 4 cartas Borough por completar la primera carrera válida, una vez. Esa misma carrera entrega sus 2 cartas normales: 6/10 tras una, 8/10 tras dos, 10/10 tras tres. El siguiente Serie requiere cinco finales. Esta ruta no depende de azar ni de victorias.

**Cajas de paddock:** una cada cinco finales válidos, sin límite de huecos ni temporizador; contiene cuatro cartas de un modelo elegible. Para la primera versión, usar una rotación determinista y visible, no rareza aleatoria. La ficha muestra el contenido antes de correr el quinto evento. En copas/torneos, cada manga válida avanza el contador y da sus dos cartas; las clasificatorias repetibles no dan cartas, CR ni dominio. No sumar un segundo paquete estándar a la liquidación final.

El objetivo dirigido no cambia automáticamente: al completar desbloqueo se ofrece «Seguir mejorando» o «Elegir otro coche». Esto evita desperdiciar cartas en un vehículo que el jugador ya no quiere desarrollar.

### Protección contra bloqueos y duplicados

Los coches necesarios para abrir una liga deben poder obtenerse en ligas anteriores. Nunca exigir un coche cuyo primer origen sea esa misma liga. Las cartas para modelos maximizados se redirigen 1:1 a otro modelo elegible de la misma banda; si todos están completos, se guardan como cartas de reserva de esa banda. No se convierten en CR, evitando un ingreso infinito adicional.

No hay compra directa repetible de coches en v2. Se conserva la propiedad de compras antiguas. Los regalos de licencia v2 son contratos que completan las cartas que falten del coche puente, no un segundo coche duplicado: Club → Evo Rally; Sport → Stingray GT. El regalo es único y el contenido se muestra de antemano.

## 5. Ligas y acceso

Nueve ligas temáticas alineadas con los entornos. Son una escalera de acceso, no temporadas con caducidad. Abrir una liga requiere **todos** los requisitos de su fila y haber abierto la anterior. Una vez abierta, permanece así. Los vehículos de préstamo no cuentan para colección.

| Liga | Colección mínima | Licencia / coche disponible | Dominio requerido de la anterior | Entrada duelo | Premio ganador | Nivel efectivo máximo |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| Club | 2 | Club / P1 | 0 | 100 | 200 | 2 |
| Bosque | 4 | Club / P1 | 40 | 200 | 400 | 2 |
| Mediterráneo | 6 | Sport / P2 | 60 | 400 | 800 | 3 |
| Desierto | 8 | Sport / P2 | 80 | 700 | 1.400 | 3 |
| Invierno | 10 | Sport / P2 | 100 | 1.000 | 2.000 | 3 |
| Pirineos | 12 | Sport / P2 | 120 | 1.500 | 3.000 | 4 |
| Reunión | 15 | Pro / P3 | 140 | 2.200 | 4.400 | 4 |
| Tokio | 18 | Pro / P3 | 160 | 3.200 | 6.400 | 5 |
| Bund | 22 | Pro / P3 | 180 | 4.500 | 9.000 | 5 |

El tope de dominio de cada liga coincide con el requisito de la siguiente; Bund tiene 200 para su distinción final. Copas y carrera libre permiten conseguir coches/licencias/CR, pero no dominio de duelo: hay que competir en la liga anterior. Perder sigue dando 6 al completar para evitar un bloqueo de habilidad indefinido; las pruebas de licencia sí exigen conducir correctamente.

Asignación de catálogo para validar antes de implementar: Club introduce al menos Borough, Käfer, Parisienne y Bubble; Bosque añade al menos Speedwell, Déesse, Willy y Kombu, y su copa da Evo Rally; las siguientes ligas añaden grupos explícitos de 4–6 modelos y conservan fuentes anteriores. Los 54 IDs deben asignarse sin huecos en un manifiesto, no mediante rangos de índice. P3 se obtiene por Sport antes de exigirlo en Reunión. La asignación propuesta completa de los 54 modelos está en [CATALOG.md](CATALOG.md), comprobada contra los IDs y clases reales; debe pasar playtest antes de activarse.

La subida de entrada es deliberadamente moderada. No se copian escalas de millones de CR: con un catálogo pequeño inflar cifras haría invisibles los premios iniciales y vaciaría la progresión anterior.

## 6. Modos y premios

### Carrera libre homologada: recuperación

Cuatro participantes IA, coches poseídos, reglamento fijado y una vuelta en circuitos de duración objetivo 45–90 s. Premios 140/110/90/80 CR; sin entrada; dos cartas objetivo al finalizar. No paga por incrementar vueltas, por recortar una pista ni por correr un trazado personalizado diminuto. Entrenamiento libre mantiene todas las opciones, sin recompensas.

Una derrota de Club (−100) se recupera con dos finales de carrera libre en último puesto (+160). Esto es una red de recuperación, no una fuente capaz de financiar con rapidez las ligas avanzadas; para estas se vuelve a una liga asequible. Mostrar siempre «Carrera libre · gratis» si no alcanza el saldo.

### Duelos de liga

Jugador contra una IA real, coche compatible y nivel efectivo limitado. Entrada E; victoria paga 2E, derrota 0, empate exacto devuelve E. Neto +E/−E/0. No se suman premios de carrera libre. Empate da 6 de dominio; ambos resultados terminados dan cartas. Abandonar pierde la entrada, sin cartas ni dominio. DNF del rival permite victoria si el jugador completa; DNF del jugador no paga.

La IA tiene perfiles públicos por liga y un nivel fijado al iniciar; no se altera para vaciar saldo, alargar sesiones ni forzar victorias. No simular jugadores conectados, avatares humanos ni ranking global. Medir ventaja por coche y circuito antes de cerrar los perfiles.

### Copas de licencia

Tres mangas, gratuitas, cuatro IA/jugador en total. CR solo al final: Club 300/220/160/100; Sport 700/500/350/200; Pro 1.200/850/600/350. Cartas por manga y contrato de coche puente en primer podio. Mantener los umbrales existentes 240 XP + podio Club y 850 XP + podio Sport; 40 XP por final válido +20 por podio y 100 XP al acabar copa. Los duelos dan 40 XP +20 por victoria, sin bonificación extra de copa.

Se elimina el bonus universal de 150 CR para nuevos perfiles v2. Los hitos anteriores ya cobrados no se repiten. Un circuito largo no puede cobrar a la vez premio de manga v1 y final v2.

### Torneos locales

Dos clasificatorias gratuitas con objetivo de tiempo, sin recompensa repetible. Tras superarlas, pantalla de inscripción explícita y cobro único. Tres mangas finales con tabla de puntos 12/9/7/5; desempate por suma de tiempos válidos, después mejor posición final y, si persiste, compartir puesto y premio correspondiente (sin fabricar una derrota). Participantes y semilla de IA quedan fijados al inscribirse. Solo cuatro participantes, todos identificados como IA salvo el jugador.

| Torneo | Entrada | Premios brutos 1.º/2.º/3.º/4.º | Netos 1.º/2.º/3.º/4.º |
| --- | ---: | --- | --- |
| Club Open | 300 | 1.000 / 450 / 150 / 0 | +700 / +150 / −150 / −300 |
| Pacific Invitational | 1.200 | 4.000 / 1.800 / 600 / 0 | +2.800 / +600 / −600 / −1.200 |
| Masters Invitational | 3.000 | 10.000 / 4.500 / 1.500 / 0 | +7.000 / +1.500 / −1.500 / −3.000 |

**No premios CR por manga.** Las cartas sí se conceden por manga completa; el premio final añade 8/6/4/2 cartas objetivo una sola vez. Retirarse no devuelve la entrada y no añade premio final. Pausar y continuar no vuelve a cobrar. No hay calendario falso ni temporadas semanales sin servidor: siempre disponibles, progreso local.

## 7. Mejoras y límites de potencia

Cada modelo tiene N1–N5. Desbloquear no mejora automáticamente. El siguiente nivel consume cartas propias y CR. La rareza de adquisición no cambia los costes de nivel: evitar un Icono caro e inviable frente a un Serie obligatorio.

| Paso | Cartas adicionales | CR P1 | CR P2 | CR P3 |
| --- | ---: | ---: | ---: | ---: |
| N1 → N2 | 8 | 200 | 600 | 1.600 |
| N2 → N3 | 16 | 500 | 1.500 | 4.000 |
| N3 → N4 | 30 | 1.200 | 3.600 | 9.600 |
| N4 → N5 | 50 | 2.800 | 8.400 | 22.400 |

Total por coche: 104 cartas posteriores al desbloqueo; 4.700/14.100/37.600 CR según clase. No ofrecer mejoras que el saldo no permite. Mostrar cartas consumidas, CR consumidos, cambio real, saldo restante y nivel efectivo de la próxima prueba antes de aplicar.

Primer perfil a probar: N2 motor +1,5 % aceleración; N3 transmisión +1 % velocidad punta; N4 neumáticos +1,5 % agarre; N5 suspensión +1,5 % respuesta. Son hipótesis, no cambios aprobados de física. No sumar +1,5 % a todas las variables por nivel ni alterar masa/escala inadvertidamente. Objetivo de aceptación: ventaja de vuelta N5/N1 aproximadamente 2–4 % en la misma pista y piloto, sin superar 5 % en la batería de superficies; si falla, retocar antes de publicar.

`effectiveLevel = min(ownedLevel, eventLevelCap)`. Un N5 puede volver a Club y corre como N2. La clase P1/P2/P3 no cambia al subir nivel. Toda prueba de licencia con préstamo usa una configuración fija. Conservar tiempos récord bajo firma de física + vehículo + nivel efectivo + circuito; no mezclar récords anteriores con coches mejorados.

## 8. Balance: qué podemos afirmar ahora

En un duelo sin empate, valor esperado CR = E × (2p − 1), donde p es probabilidad de victoria. A 35 % se pierde 0,30E por carrera; a 50 % el duelo es neutro; a 65 % se gana 0,30E. Las cartas progresan incluso si el resultado monetario es negativo. El ingreso estable viene de carreras gratuitas y hitos; las mejoras absorben CR.

Ejemplo Club, sin mejoras: 20 duelos, 7 victorias y 13 derrotas consumen los 600 CR iniciales. Es un ejemplo aritmético; el orden de derrotas puede dejar sin entrada antes. Debe modelarse cartera y política de recuperación, no solo valor esperado.

Con puestos equiprobables en Club Open: premio medio 400 CR − entrada 300 = +100 por torneo, antes de considerar duración. La entrada no es un sumidero universal: contra IA el sistema emite o retira CR según resultados. La inflación del jugador experto no se arregla fingiendo rivales humanos; se mide y ajusta con mejoras, colección, duración y límites de nivel. No hacer ranking por saldo acumulado.

El script `simulate.mjs` usa exactamente `balance.json`, simula 10.000 perfiles por tasa de victoria, 100 duelos Club y la regla conservadora de jugar gratis hasta tener cinco entradas. Reporta recuperación, percentiles de saldo y ritmo de primeras cartas; no simula física, todas las ligas, decisión humana, cajas extra ni mejoras. Su resultado sirve para detectar errores de números, no para prometer retención.

Objetivos de playtest (por validar): primer coche en tres finales; cuarta posesión en ocho finales dirigidos sin cajas; primera liga nueva en 8–15 finales combinando colección/dominio; primera mejora útil antes de 30 minutos; siguiente objetivo visible a una o dos sesiones. No dar por garantizado el tiempo hasta Bund sin simulación completa y conducción real.

## 9. Pantallas y estados

**Actualización:** [Navegación, salidas y celebraciones](NAVIGATION_AND_CELEBRATIONS.md) define la barra de cinco destinos, salida visible en todas las rutas, popups de logros y vuelo de CR/cartas. Prevalece sobre la navegación dibujada en las dos primeras láminas. Incluye una tercera lámina de celebraciones.

Mockups: [carrera, recompensa y cartas](../../art/ui-references/economy-2026-11-02/01-carrera-recompensa-cartas.png) y [ligas, torneo y mejora](../../art/ui-references/economy-2026-11-02/02-ligas-torneos-mejoras.png). Dos láminas, seis pantallas, una misma dirección visual; no son seis alternativas.

1. **Carrera / liga actual:** circuito protagonista, reglamento y clase, entrada, victoria bruta y neto, objetivo de cartas; CTA «Preparar carrera». Entrada gratuita secundaria siempre accesible.
2. **Resultado:** neto grande; entrada y premio separados; cartas, dominio y siguiente objetivo. Guardar primero, animar después. Derrota: «−100 CR · +2 cartas · +6 dominio», sin disfrazarla de victoria.
3. **Garaje / descubrimiento:** miniatura en estudio, cartas actuales/requeridas, origen de cartas y desbloqueo gratuito. «Probar en taller» no crea propiedad. Carrusel para poseídos, colección de fichas para descubrir; no reemplazar la cuadrícula de elección de coche para correr.
4. **Ligas:** una siguiente liga protagonista; lista concreta de requisitos, progreso y CTA que lleva al requisito pendiente. Una liga abierta pero sin saldo sigue abierta.
5. **Inscripción de torneo:** tabla de cuatro premios y netos, coste único, duración, saldo después, reglas de abandono y continuación. Se cobra al confirmar esta acción, no al abrir la ficha.
6. **Mejora:** coche y cambio mecánico concreto, cartas, CR, límite de liga y saldo posterior. Sin activación si falta un recurso.

Se mantiene el recorrido **Circuito → Reglas → Coche**. Elegir liga filtra circuitos; elegir evento puede prefijar circuito/reglas, pero los tres pasos siguen visibles y revisables. En la última pantalla se confirma el coste y se inicia el intento. Volver atrás antes de confirmar no cobra.

Usar colores reales de `league.css`: fondo #141c24, acción #eb8dbb, información #a8d8f7; Barlow Condensed/DM Sans. Primario rosa, bloqueo explicado con texto/icono y no solo color. Objetivo mínimo 44 px por control, cuerpo 14–16 px, safe areas, scroll sin ocultar CTA, teclado y foco visible. Respetar reducción de movimiento. No abrir un modal por cada premio.

Estados adicionales a implementar: saldo insuficiente con carrera gratuita; cartas insuficientes con fuente; coche incompatible; liga abierta sin coche compatible por corrupción de save; cartas excedentes; N5; empate; DNF; premio ya cobrado; almacenamiento lleno; reanudación; migración pendiente. El mockup raster comunica composición, no sustituye estos contratos.

## 10. Arquitectura local preparada para servidor

Separar configuración de balance, dominio económico y presentación. `EconomyService` ofrece los mismos comandos con adaptador local hoy y remoto después. No poner pagos en componentes UI ni confiar en precio enviado por el cliente.

Modelo propuesto: `schemaVersion`, `balanceVersion`, `revision`, `profileId`, `wallet`, `vehicles[id]: {owned, cards, level}`, `licenses`, `leagueProgress`, `claimedMilestones`, `activeRun`, `activeAttempt`, `receipts`, `telemetryQueue`. El registro de torneo guarda versión de reglas, coche, nivel efectivo, pista, participantes, semilla, clasificación y coste pagado.

Comandos: `quoteEntry(eventId, vehicleId)`, `enterEvent(commandId, quoteRevision)`, `beginAttempt(runId)`, `settleAttempt(attemptId, raceEvidence)`, `unlockVehicle(commandId, vehicleId)`, `upgradeVehicle(commandId, vehicleId)`, `retireRun(commandId)`. Consultas no mutan; comandos validan saldo, propiedad, liga, clase, versión y revisión. Un doble toque usa el mismo commandId. Cotización caducada fuerza recálculo visible.

**Atomicidad:** validar sobre copia, calcular débito/premio, incluir recibo y revisión, guardar todo en una operación durable y solo entonces mostrar éxito. Si falla persistencia, seguir en modo sesión claramente identificado y permitir exportar snapshot; no fingir que fue guardado. Para varias pestañas, preferir transacción IndexedDB + bloqueo de escritor y comprobación de revisión; `localStorage` de un objeto por sí solo no resuelve escrituras concurrentes.

Máquina de estados: `quoted → entered → racing → settled`; torneo `qualifying → qualified → paid → stageN → completed` o `retired`. Salir de la aplicación conserva entrada y fase. Al recargar una carrera sin estado de conducción persistido se reinicia esa manga con misma semilla y nivel, sin cobrar otra vez; no concede nada por el intento abandonado. Este comportamiento permite repetir una mala salida offline y se acepta expresamente como límite local. Una futura competición online necesita otra política autoritativa.

Recibo de liquidación: referencia de entrada, débito ya realizado, bruto, neto, cartas, dominio, hitos, saldo antes/después, versiones y evidencia utilizada. **El neto mostrado no vuelve a descontar la entrada.** Eventos ya terminados no pueden reabrirse para liquidar otra vez aunque se compacte el historial de recibos.

## 11. Migración y continuidad

Mantener copia intacta de `prl.league.v1`; crear snapshot v2 con marca de migración y checksum de diagnóstico (no seguridad). Conservar CR, XP, coches poseídos, mejores resultados y personalización. Todos los coches heredados pasan a N1; no inventar cartas retroactivas ni cobrar su desbloqueo. Licencias ganadas conservadas. Las ligas nuevas se evalúan por sus criterios, mostrando progreso migrado sin regalar dominio no demostrado.

Si hay torneo/copa activo v1, acabarlo bajo sus reglas antiguas y su precio antiguo antes de migrar el perfil completo. No cambiar premios de una inscripción pagada. Una migración repetida no regala otra vez saldo, cartas ni hitos. Si falla validación, preservar original, ofrecer exportar y explicar el error; no reiniciar silenciosamente.

El modo QA continúa íntegramente en memoria. Añadir perfiles de demostración independientes del save real para probar pobreza, colección parcial, desbloqueo y N5. Un selector QA no es una compra ni un premio.

Al portar online, servidor decide saldo, pagos, catálogo, RNG si existiera y resultado válido. Save local importado no se considera historial competitivo verificado. Proponer conservar colección local para modos offline y una decisión explícita de migración de cuenta; no prometer que millones de CR editables pasarán a competitivo. No hacen falta servicios online para validar ahora la UX y el balance básico.

## 12. Implementación posterior: entregables y aceptación

1. **Configuración y simulación completa:** manifiesto de 54 vehículos; liga, cartas, fuente y niveles; todas las rutas de acceso alcanzables. Simular novato/medio/experto, rachas, mejoras, torneos y objetivo de colección. Sin ciclos de dependencia ni saldo negativo.
2. **Dominio económico v2 y migración:** comandos, recibos, guardado transaccional, migración repetible, cierre de evento v1. Pruebas de doble clic, recarga, dos pestañas, disco lleno, recibos antiguos y balances inválidos.
3. **Loop vertical Club/Bosque:** carrera real → CR/cartas/dominio → desbloqueo → liga, con seis pantallas y taller sin propiedad. No lanzar nueve ligas solo porque existan filas de configuración.
4. **Mejoras físicas:** integrar perfil efectivo, benchmark por cinco familias y varias superficies; actualizar HUD/índices y firmas de récord. Verificar que los límites se aplican al jugador y a IA.
5. **Torneos y expansión:** clasificatorias, pago final único, continuación, empate/retirada; desplegar los siguientes entornos cuando estén validados. Test de rutas y dificultad de cada evento.
6. **Playtest móvil y ajuste:** sesiones de 15–20 min con distinto nivel; medir comprensión y cartera; retocar balance versionado sin reescribir partidas ya pagadas.

Telemetría local exportable: race_started/completed/abandoned, entry_paid, reward_settled, card_earned, vehicle_unlocked/upgraded, league_unlocked, insufficient_funds, recovery_race, save_failed. Incluir versión, liga, duración real, saldo antes/después, coche/nivel, dificultad y origen de recompensa. No recoger identidad personal para esta prueba.

Criterios de decisión: usuarios distinguen bruto/neto; pueden explicar cómo conseguir el siguiente coche; no se quedan sin modo jugable; no necesitan gastar para aprobar licencias; rivales N1/N5 respetan límite; reinicio no duplica premio; compra/mejora no produce saldo negativo; partidas existentes sobreviven. Si una mejora domina todos los circuitos, rebalancear conducción antes de añadir más economía.

## 13. Qué revisar ahora

Recomendación: validar cartas dirigidas y desbloqueo gratuito; riesgo monetario en duelos/torneos; dominio permanente; mejoras pequeñas con tope; estética de seis pantallas. Después construir primero Club/Bosque. Cajas con temporizadores, rarezas aleatorias, tienda premium y temporadas quedan fuera de esta versión; requerirían diseño y validación propios, no son deuda imprescindible para portar el sistema a servidor.
