# Pocket Racing League — local economy

**Economía v2 implementada:** consulta [estado, reglas activas y validación](docs/economy/IMPLEMENTATION.md). Incluye cartas, nueve ligas, mejoras, torneos, cinco destinos y celebraciones. Los importes de recuperación se ajustaron tras simular la progresión.

## Histórico v1 · conservado para eventos ya inscritos

> Next design iteration: [Economy v2 proposal](docs/economy/ECONOMY_V2_PROPOSAL.md), [54-car acquisition catalogue](docs/economy/CATALOG.md), and [balance model](docs/economy/BALANCE_CHECK.md). The user confirmed design and mockups first on 2 November 2026. The proposal led to the v2 implementation linked above; the rules below document legacy events only.

This release implements a local league against the game's driving AI. It does not simulate real online opponents, global tournament participation, seasons or purchases with real money. Save key: `prl.league.v1`; existing lap/ghost/career data remain separate and unchanged.

## Player loop

Home → quick race / championship / tournament / record challenge → real race results → earned credits and XP → collection and new licenses. Garage shows 3D renders of owned cars and opens the live customizable studio. Settings stay separate from the player profile.

- Start: 600 CR, Truck Classic and Bambino 59. Previously selected and legacy career unlocked cars are grandfathered in.
- Finish a quick race or championship manga: 60 CR + 180 / 130 / 100 / 70 CR for first / second / third / the remaining positions. XP: 40 + 20 for podium. A longer race does not multiply the reward.
- P1 prices: 900–2180 CR; P2: 2800–6440; P3: 6500–10550. The first additional P1 is affordable after two wins or four last-place finishes. Prices are deterministic, not loot drops.
- Club license is free. Sport requires 240 XP and a Club Cup podium; Pro requires 850 XP and a Sport Series podium. XP alone cannot bypass the race achievements.
- A first Club Cup podium gifts Evo Rally. A first Sport Series podium gifts Stingray GT (C7). Three races with podiums plus the cup bonus give 280 XP, so Club immediately opens Sport. The Sport podium plus approximately five further podium races reaches Pro.
- No energy, repairs, negative wallet, paid stat upgrades, consecutive-day penalties, consumables or randomized prizes. Cosmetics do not cost credits. A free quick race is always available.

## Competitions

| Event | Entry | Stages | Final CR: 1 / 2 / 3 / rest |
| --- | --- | --- | --- |
| Club Cup | free | Puerto, Aserradero, Faro · 1 lap | 650 / 450 / 300 / 180 |
| Sport Touring | free | Silverstone, Suzuka, Interlagos · 3 laps | 1300 / 900 / 650 / 350 |
| GP Masters | free | Spa, Monza, Austin, Suzuka · 3 laps | 2400 / 1600 / 1100 / 600 |
| Club Open | 200 CR after qualifying | 2 cuts + Faro, Club, Puerto | 950 / 650 / 450 / 200 |
| Pacific Invitational | 500 CR after qualifying | 2 cuts + Suzuka, Interlagos, Monza | 1900 / 1300 / 900 / 500 |

Final bonuses are in addition to each manga's finish prize. First podium in an event adds a one-time 150 CR. Points are 12 / 9 / 7 / 5 for the four-driver field; actual AI positions at the player's finish feed the standings, without scripted player victories. Ties go to the rival. Events retain the same car throughout. The player can pause, leave and resume the next unfinished stage. Explicit retirement forfeits an already-paid final entry; qualifying retries are free. All finishers recover the tournament entry through the final participation prize.

Qualifying objectives were checked against the actual physics with novice, club and expert AI:

- Club Open cuts: Puerto 45 s, Aserradero 55 s. Novice reference in the starter car: ~29.2 / 36.5 s.
- Pacific cuts: Suzuka 130 s, Silverstone 125 s. Novice Evo Rally reference: ~114.1 / 106.1 s.
- Suzuka challenge: bronze 150, silver 115, gold 100 s. Starter car references ~119.4 / 102.6 / 95.8 s for novice / club / expert.
- Cobra loaner challenge at Faro: bronze 50, silver 38, gold 31 s. References ~34.8 / 34.0 / 29.1 s. Loaner use does not grant ownership.

A challenge pays 150 CR per newly earned medal plus 50 CR for a valid medal lap. Later repeats pay only 50 CR, which avoids making repeated medals more profitable than normal racing. These are initial tuning values, not claims of long-term balance from player telemetry. No artificial live timers.

## Persistence and integrity

Results settle only for an active attempt token and enough real completed laps. Incomplete results, invalid lap times and repeat result submissions pay nothing. Each transaction writes wallet, XP, standings, unlocks and receipt together. A reloaded stage gets a new token; paid entry remains recorded on the run. Old result tokens cannot pay again. If browser storage is unavailable, the game remains playable and the UI explicitly marks progress as session-only. This is a client-side offline game, not an anti-cheat backend or cross-device account system.

The explicit `?autopilot=1` QA mode routes all writes to memory. Test rewards and unlocks disappear on reload and do not modify a player's persisted progression.

## Presentation

Implements selected Home concept 2 with new event raster art, the existing local fonts/icon library, a real Suzuka route preview, category banners and persistent labeled navigation. Short entrance/reward transitions and existing garage camera motions respect `prefers-reduced-motion`. New raster assets total about 1.2 MB as JPEGs rather than shipping the 6.5 MB PNG masters.

Inspiration: [Gran Turismo circuit events](https://www.gran-turismo.com/gb/gt7/manual/worldcircuit/02) for car-class events and collection goals; Golf Clash's staged qualifying structure for tournament progression. Rules, currency, artwork and prize tuning are specific to PRL.
