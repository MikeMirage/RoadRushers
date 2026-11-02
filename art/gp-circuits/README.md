# Compact GP circuits

Eight geographic silhouettes adapted into ordinary editable road modules. Runtime data lives in `src/tracks/gp-world-tour.json`; the in-game registry is `src/gp-circuits.js`.

`source.geojson` contains the eight source features from [Tomislav Bacinger's f1-circuits](https://github.com/bacinger/f1-circuits), used under MIT. `provenance.json` records the original dataset hash. The full upstream license is distributed in `public/licenses/f1-circuits.txt`. Official guides and maps are linked per circuit in `design.json`; no map images or logos are copied.

## Authoring

The generator locally projects longitude/latitude, scales each closed polygon, simplifies the path and fits tangent circular fillets. The constrained fit retains the silhouette while providing at least 8 m of radius and valid connectors. The grid is placed on the approach to the real first corner; Silverstone and Monaco source polygons need a different start phase. Authored height profiles, width transitions and Monaco's curved tunnel become ordinary editor fields. Suzuka's crossing has about 8 m of separation.

Regenerate with Python, NumPy and SciPy:

```sh
uv run --with numpy==1.26.4 --with scipy==1.13.1 scripts/generate-gp-circuits.py
node scripts/build-gp-atlas.mjs
```

Python is only needed for authoring; the game and CI consume checked-in JSON. The atlas and native editor downloads are in `public/gp-world-tour/`.

## Validation

```sh
node --test tests/gp-circuits.test.js
node scripts/gp-circuit-qa.mjs
npm test
npm run build -- --base /RoadRushers/
```

Geometry checks cover length, closure, grades, editor round trips, template identity, geographic deviation, grid launch, the crossing and tunnel clearance. Driving QA completes a real simulated lap with three different vehicles on each course and checks for progress jumps. It writes its report to `artifacts/gp-world-tour/driving-checks.json`.
