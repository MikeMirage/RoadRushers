# Economía local v2 · implementación

2 de noviembre de 2026. Implementación de la propuesta aprobada. Sin servidor, compras reales ni clasificación mundial ficticia.

## Funciones activas

- Navegación Events / Career / Drive / Cars / Rankings, también en el garaje. Drive prepara salidas; nunca cobra al pulsar la sección.
- Circuito → Reglas → Coche en carreras libres y competiciones. Las reglas de evento están prefijadas y visibles; el último botón confirma coste y salida. Cancelar antes no cobra.
- 54 modelos con fuente explícita y 10/20/40 cartas de desbloqueo. Objetivo dirigido, contrato inicial, caja determinista cada cinco finales y reservas de duplicados. Propiedad permanente y desbloqueo gratuito.
- Nueve ligas con colección, licencia, dominio y coche de clase adecuada. Dominio 12/6, permanente y acotado; entradas 100–4.500 CR. Duelo real de dos coches, sin resultados prefabricados.
- Tres copas gratuitas, tres torneos con clasificatorias y premio final, dos desafíos. Continuación local de fases; entrada única, premios netos y retirada explícita.
- Mejoras N1–N5 con CR/cartas, aplicación a física real, límites por competición y configuración equivalente para IA. Los índices de garaje marcados «De serie» siguen describiendo fábrica; Cars muestra nivel, coste y cambio mecánico. Récords separados por configuración física efectiva.
- Taller de cualquier modelo y prueba en pista sin conceder propiedad ni premios. Personalización existente conserva su guardado inmediato.
- Rankings locales: XP por defecto, tiempos filtrables por circuito, competiciones y colección. Los tiempos corresponden a sus propios coches/configuraciones; no se fabrica un puesto mundial.
- Celebraciones de premios, coche adquirido, mejora, licencia, liga y récord personal. CR a cartera, cartas a contador, saldo visual animado; datos guardados antes de animar. Un popup por recibo, cierre inmediato, resumen persistente en Career.
- X en resultados y preparación; Atrás/Cerrar en fichas, garaje, ajustes y editor. Atrás del navegador cierra primero la vista secundaria. Ajustes desde preparación regresa al mismo paso. Cerrar evento no llama a retirada.
- Exportación JSON del perfil e historial económico local; opción de animaciones reducidas en Career y respeto de `prefers-reduced-motion`.

## Balance que cambió tras simular

La primera propuesta pagaba 80–140 CR en cualquier carrera gratuita. El modelo completo mostró demasiada recuperación en niveles altos: a 35 % de victorias, mediana de 852 carreras hasta abrir Bund con la política de recuperación simulada.

Ahora la base por último puesto es `max(80, ceil(entradaMayorLiga / 50) * 10)`. Premios por puesto: base × 1,75 / 1,375 / 1,125 / 1, redondeados. Club conserva 140/110/90/80; Bund ofrece 1.575/1.238/1.013/900. La UI muestra la cifra de la cuenta antes de salir. Una entrada de la liga más alta se recupera en cinco finales gratuitos como máximo, incluso acabando último.

Con el nuevo balance, la misma simulación abre Bund con mediana 294/179/168 carreras a tasas de victoria 35/50/65 %. Son resultados del modelo, no datos de jugadores ni tiempos prometidos. Asume podios en copas de licencia, no compra mejoras, elige modelos baratos y recupera con carreras gratuitas. Sirve para verificar accesibilidad de las nueve ligas y detectar bloqueos, no para dar por finalizado el balance.

Las nueve ligas usan circuitos existentes homologados: Club conserva Puerto/Faro y las otras ocho usan sus pistas temáticas ya disponibles (Bosque, Amalfi, Sahara, Noruega, Pirineos, Reunión, Tokio y Bund). Esta entrega no crea nueve entornos artísticos nuevos ni un calendario de liveops. Las entradas y costes son datos versionados ajustables.

## Persistencia e integridad

Clave activa `prl.league.v2`; `prl.league.v1` permanece intacta. Se conservan CR, XP, propiedad, personalización y resultados antiguos. Coches heredados empiezan en N1. Un evento v1 ya iniciado conserva su tabla original hasta completarlo o retirarse; sus nuevas carreras de recuperación usan las reglas v2.

Cada comando calcula una copia, verifica revisión y escribe un snapshot con recibo/revisión. Web Locks serializa comandos de pestañas cooperantes; una pestaña desactualizada recibe un aviso y debe recargar. Tokens de intento invalidan resultados anteriores. No se concede nada por un intento incompleto. La entrada queda en el run, por lo que recargar/reanudar no la vuelve a cobrar.

Ante snapshot incompatible o roto, preservar el original y usar sesión aislada con aviso/exportación. Ante falta de almacenamiento, continuar en memoria y mostrar el estado. El modo `?autopilot=1` usa exclusivamente el adaptador de pruebas en memoria. No es un backend antifraude: editar almacenamiento local sigue siendo posible; el servidor futuro deberá validar saldos y resultados.

Una carrera de recuperación puede jugarse con un torneo pendiente sin borrarlo. Guardar y salir de una carrera conserva su fase; volver reinicia esa manga sin coste adicional. No conserva posición de conducción a mitad de vuelta. En un torneo, los empates por puntos se comparan por tiempos finales disponibles y luego última posición; cuando el motor termina la simulación al cruzar el jugador, los rivales aún en pista no tienen tiempo final y se usa el siguiente criterio. No se inventan tiempos.

## Verificación

- `npm test`: batería completa del proyecto, incluidas regresiones v1 y economía v2.
- `npm run build`: compilación de producción. Sigue existiendo el aviso de tamaño del chunk Three.js/GLTFLoader.
- `node scripts/economy-progression-simulation.mjs`: 150 perfiles, tres tasas de victoria, recorrido hasta Bund con la autoridad económica real. Salida en `artifacts/economy-progression-simulation.json`.
- `node scripts/economy-upgrade-benchmark.mjs`: 30 combinaciones, cinco familias de vehículo, dos pistas, asfalto/grava/hielo, mismo piloto experto a 120 Hz. Diferencia N5 respecto N1 entre −1,74 % y +2,26 %; ninguna ventaja supera el 5 %. No promete que una mejora reduzca todos los tiempos: el control y la superficie importan.
- Interfaz real con piloto QA: duelo de entrada 100 → premio 200 → neto +100; cerrar conserva saldo. Tres carreras gratuitas → 10 cartas Borough → desbloqueo gratis → popup y acceso al garaje. Coche bloqueado visible en taller.
- Viewports CSS comprobados: 390×844, 320×567 y 844×390. Cierre de celebración de 48×48 px y footer visibles en móvil pequeño/horizontal. Preparación cancelada conserva 600 CR. Atrás vuelve a Drive. Ajustes regresan al paso Reglas.
- Evidencia: `artifacts/economy/unlock-mobile.png`. Es captura de la implementación con el modelo real, no un mockup.

## Mapa de código

`src/economy-config.js` y `economy-catalog.js`: reglas, fuentes y ajustes mecánicos.
`src/league.js`: autoridad local, transacciones, migración y liquidación.
`src/league-legacy.js`: reglas conservadas para eventos antiguos.
`src/league-ui.js` y `economy.css`: navegación, catálogo, ligas, inscripciones y rankings.
`src/economy-celebration.js`: presentación omisible que no modifica recursos.
`src/main.js`: conexión con carreras, préstamos, historial de navegación y diálogo.

Queda validación con jugadores y dispositivos móviles físicos, y el backend/servicios online previstos para otra fase. No hace falta implementar esos servicios para jugar el bucle económico local.

Validación de publicación: 332 tests correctos y compilación con base `/RoadRushers/`. El benchmark de 30 combinaciones se repitió con la física publicada en d9713dd, sin incluir la revisión pendiente de contactos/sonido. Las mejoras N5 siguen por debajo del límite del 5 %.
