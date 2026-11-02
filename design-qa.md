# Home concept 2 — design QA

final result: passed

## Evidence

- Source: selected option 2, 852 × 1846, normalized to 390 × 844 CSS pixels for comparison.
- Implementation: production build served with `/RoadRushers/`, captured at 390 × 844 CSS pixels.
- Combined comparison: `artifacts/league-2026-11-02/comparison-final.jpg`; both images were displayed together at the same dimensions, not judged from separate recollections.
- Supporting captures: `home-mobile.jpg`, `collection-mobile.jpg`, `garage-landscape.jpg`, `cup-unlock.jpg` in that directory. These are local QA evidence, excluded from the game deployment.

## Iterations

Initial comparison: blocked (P2). The masthead lacked the pale-blue racing bars, the hero lacked the route preview, and the condensed italic category/ribbon treatments did not yet match the selected reference. The quick-race action also needed its race flag and stronger italic treatment.

Corrected comparison: passed. Added the bars, existing helmet art for the circular profile action, the actual Suzuka route from the game's circuit data, the flag and the italic accents. Re-captured and viewed source and implementation in a single comparison image. There are no remaining actionable P0/P1/P2 visual discrepancies for this scope.

The visual hierarchy, condensed local typography, charcoal / pink / pale-blue palette, featured Suzuka art, two category banners, roadster row and four labeled navigation destinations match the selected direction. The additional license / CR / XP row is required by the subsequently authorized game economy. Banner copy describes actual playable events; P2 communicates its license requirement, and Cobra is a real free loaner challenge. The route reflects the actual compact game circuit rather than tracing a decorative reference outline. The artwork is supplied as separate generated raster assets, not an embedded screenshot of a mockup.

## Functional checks

- Browser: real three-manga Club Cup completed by the test-driving AI, across Puerto / Aserradero / Faro. Each manga credited its finish award, the final credited 1040 CR / 160 XP, gifted Evo Rally and opened Sport; home reflected 2120 CR / 280 XP. Test writes were memory-only.
- Browser: owned collection → live 3D studio → next car → Use in race → quick setup retains Bambino. The race picker offers the two owned cars, rather than the full 54-car catalog. A quick race completed and awarded 240 CR / 60 XP.
- Browser: garage at 844 × 390 shows both starting cars with a fitted camera, visible Use in race / Customize / Facts actions, and labeled navigation. The same collection is navigable in portrait.
- New economy tests cover purchase limits, license gates, actual accumulated points, unique gifts, duplicate receipt rejection, persistence, qualifier retries, entry charged once across reload, loaner ownership, affordable progression, unavailable storage, malformed saves, legacy career migration, catalog track validity and owned-only selection.
- Full test suite: 312 passed, 0 failed. Production compilation with base `/RoadRushers/` passed. `git diff --check` passed.
- Observed browser console: no runtime errors in tested flows.
- All new home actions have >=44px targets, visible focus styles and persistent labels. Existing keyboard/gamepad menu navigation is retained, with back routing and shoulder-tab routing connected to the new destinations. Reduced-motion media queries disable the new transitions.

## Limits

Responsive browser checks and automated input tests do not certify a physical console, gamepad or mobile GPU. No new claim of physical-device certification is made. Progress is stored in this browser, not a cross-device online account. Economy targets are an initial calibration against real AI/physics laps and deterministic reward simulations; longer-term pacing needs actual play feedback.

Additional post-integration check: Club Open Q1 completed in 23.86 s against the 45 s cut, advanced the stage, and charged no entry. The first horizontal results check exposed a P1: fixed-height content pushed actions below 390 px. Corrected the short-screen result layout to scroll the full content with an opaque sticky footer. Verified the captured real result with the final production CSS: footer bottom 378 px in a 390 px viewport, opaque RGB(25,35,46), overflow auto, scrollTop 185 with actions still in view. `result-landscape.jpg` records that correction. Qualifier and challenge headings now state their actual event type, and a failed qualifier offers a retry rather than claiming progression.
