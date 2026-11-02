# Comprobación numérica · propuesta v2

Reproducible: `node docs/economy/simulate.mjs`. Semilla inicial 20261102.
No toca el juego ni el guardado. 10.000 perfiles por tasa; 100 duelos Club por perfil.
Política: antes de apostar, recuperar hasta cinco entradas con carreras gratuitas en último puesto.
No incluye compras, mejoras, cajas, torneos, licencias ni ascensos. Los percentiles son de este modelo, no de jugadores reales.

| Victoria | Recuperaciones medias | Recuperaciones P50 | Saldo P10 | Saldo P50 | Saldo P90 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 35% | 37.6 | 38 | 400 | 600 | 840 |
| 50% | 8.5 | 7 | 600 | 1160 | 2160 |
| 65% | 1 | 0 | 2400 | 3600 | 4800 |

La recuperación es una carrera adicional, no una devolución automática. Una política tan prudente exige demasiadas carreras gratuitas al novato durante 100 duelos: probar reservas sugeridas de 3–5 entradas y dificultad Club antes de cerrar balance. No compensar derrotas ocultamente.

Primer Serie: 3 finales; siguiente Serie: 5; cuarta posesión: 8 finales dirigidos sin cajas. No demuestra acceso a Bosque: falta dominio de duelos.

## Valor esperado y sumideros

- club: entrada 100; valor esperado a 35/50/65% = -30 / 0 / 30 CR por duelo.
- forest: entrada 200; valor esperado a 35/50/65% = -60 / 0 / 60 CR por duelo.
- mediterranean: entrada 400; valor esperado a 35/50/65% = -120 / 0 / 120 CR por duelo.
- desert: entrada 700; valor esperado a 35/50/65% = -210 / 0 / 210 CR por duelo.
- winter: entrada 1000; valor esperado a 35/50/65% = -300 / 0 / 300 CR por duelo.
- pyrenees: entrada 1500; valor esperado a 35/50/65% = -450 / 0 / 450 CR por duelo.
- reunion: entrada 2200; valor esperado a 35/50/65% = -660 / 0 / 660 CR por duelo.
- tokyo: entrada 3200; valor esperado a 35/50/65% = -960 / 0 / 960 CR por duelo.
- bund: entrada 4500; valor esperado a 35/50/65% = -1350 / 0 / 1350 CR por duelo.

- club-open: netos 700 / 150 / -150 / -300 CR; expectativa equiprobable 100 CR por torneo.
- pacific: netos 2800 / 600 / -600 / -1200 CR; expectativa equiprobable 400 CR por torneo.
- masters: netos 7000 / 1500 / -1500 / -3000 CR; expectativa equiprobable 1000 CR por torneo.

Mejorar N1–N5 consume 104 cartas y p1: 4700 CR; p2: 14100 CR; p3: 37600 CR.

Antes de producción: simulación completa de todos los modelos, decisiones de gasto, tasas de victoria por circuito, cartas sobrantes, progresión de licencias y distribución del tiempo hasta cada liga.

