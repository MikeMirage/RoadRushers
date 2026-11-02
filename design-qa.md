# Club portrait — design review status

final result: blocked

## Current visual target

The user refined the flow while the original Club home/garage implementation was being tested: select circuit, then rules, then a compatible car. The user explicitly requested a mockup first. The revised proposal is saved in `art/ui-references/race-flow-portrait-2026-11-02/` as three separate 887 × 1774 images, all 1:2 portrait.

The revised flow has not been implemented or handed off as complete. The earlier preview remains a draft of the previous home/garage arrangement. It must not be mistaken for the revised circuit/rules/car flow.

## Required next comparison

Implement against the agreed revised mockup, then capture each corresponding step at the same viewport and state. Put source and implementation together in one comparison input before evaluating typography, layout, color, imagery and content. In particular:

- Circuit first: route over circuit-inspired scenery, followed by “Elegir reglas”.
- Rules second: mode, laps, field, difficulty, contact and car category, followed by “Elegir coche”.
- Car third: eligible collection only; “Salir a pista” appears here.
- Same-model rule resolves from the car selected in the third step.
- Japanese eligibility requires per-car origin metadata; the mixed Japan/rally collection is not an origin filter.
- Power-class thresholds remain undefined; mockup labels must not become invented horsepower values.
- Verify 9:16 and 1:2 layouts, keyboard and touch targets, navigation and the final race launch.

## Evidence and checks from the earlier draft

- Source: `art/ui-references/club-selected/club-portrait-reference.png`.
- Captures: `artifacts/club-portrait/home-390x780.png` and `artifacts/club-portrait/garage-390x780.png`.
- Preview: `http://127.0.0.1:4176/` (earlier flow, not the revised target).
- Targeted UI checks: 44 passed, 0 failed; `artifacts/club-portrait/ui-tests.log`.
- Isolated production build passed; `artifacts/club-portrait/build.log`.
- The full-suite baseline already had five model-related failures before these UI changes; `/tmp/prl-club-baseline-tests.log`. These do not establish a passing full-suite result.

No visual-fidelity pass is claimed while the screen order differs from the revised target.
