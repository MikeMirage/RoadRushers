# Vehicle production pipeline — work in progress

User scope: refine Corvette resemblance first, then deliver and integrate five vehicles sequentially: Corvette C7 (`c7-sport`), Cobra427 (`velo`), RAM crew cab (`coda`), Stelvio first generation (`stelvio-suv`), reference Lancer (`apex`). Preserve fifty collection vehicles and all unrelated local changes. No publish/push. Full specification: USER-BRIEF.txt.

## Active direction — user approval of segmented viewer

The user explicitly approves the appearance of Magnific `EbZlVU0uuO` and asks to optimize **that model**, reducing materials to simple colors plus normal maps, then present it in a dark GT-inspired studio as the example for a future garage. This supersedes the previous rejection of its chrome-like appearance and the continuous-source reconstruction strategy. Preserve its approved proportions uniformly, not nominal CAD dimensions.

Astra now owns conservative per-part optimization of `art/vehicle-pipeline/magnific/corvette-user-parts/textured-pbr.glb`, including separating the rear-left wheel faces from source part0. New isolated export: `public/models/corvette-study/model.glb` + manifest/normal atlas/ZIP/native blend. Rig uses BodySuspension, Suspension_*, Steering_*, Wheel_*; material extras vehicleRole paint/glass/trim/rubber/rim/metal/brake/lights. Studio may use25–40k triangles when necessary to retain approved shape; do not claim it meets race8–10k.

Root built `corvette-studio.html`, `src/corvette-studio.js` and `.css`: dark studio, one-time softbox PMREM, real-time car, reference engine stats, actual-model thumbnails, colors/finish/skin/wheel/suspension/rig controls, measured asset inventory. Build passes; actual visual/GPU QA awaits first asset. Existing garage and production registry stay unchanged pending approval. Finish this approved study before continuing the five-car sequence.

## Previous gates / history

- Corvette reference shape: **in progress with Astra**. Version1 source/export preserved for comparison. Do not label photography-derived model dimensionally exact1:1.
- Magnific pilot completed: Tripo H3.1 multiview, 580 credits, 196,937 triangles/51 parts. Original and normalized Blender review in `art/vehicle-pipeline/magnific/corvette-c7`. Better source silhouette; irregular part boundaries and soft details require cleanup/retopology. Not a production asset. Astra evaluating guided reconstruction against this source.
- User supplied a better continuous candidate: https://www.magnific.com/app/creation/WDrmfGJcXe . Metadata identifies **Tripo 3.1**, despite the user's informal "meshi 3.1" name. Downloaded and inspected at `art/vehicle-pipeline/magnific/corvette-user-sample`: 96,498 tris, 57,074 vertices, 1 primitive/material, 2K base color only, no rig/normal/ORM/tangents. Positional-seam component audit gives 2 components; wheels are part of the main connected shell. Preferred shape guide, not a production-ready wheel rig. Exact requested face limit is not exposed by metadata.
- First dense nearest-surface fit was rejected for dents/pinching. Astra now extracting smoothed guide sections, preserving authored detail and clean topology; unapproved candidates must not replace the active garage GLB.
- Subsequent radial reconstruction also rejected (lost features). Astra now preserving the user's continuous source as the high, cutting fused wheels and replacing them with clean rigged wheels. Candidate outputs: `art/corvette-c7/candidates/extracted`; active garage restored to V2 meanwhile.
- User's segmented sample https://www.magnific.com/app/creation/LwpiBumswO downloaded to `art/vehicle-pipeline/magnific/corvette-user-parts`: 38 meshes/95,866 tris/no textures, expected because `generateParts` disables texture generation. Separate Tripo PBR texturing completed for400credits: https://www.magnific.com/app/creation/EbZlVU0uuO ; 38 meshes/95,826 tris/38 materials/114 images/9,493,312bytes. Estimated uncompressedRGBA8+mips payload73,269,096bytes. Preview excessively metallic. Useful semantic/material source, not final mobile materials; source and retexture both preserved.
- Tripo retopology request10000triangle (630credits) returned12813tris/1mesh with visible holes/folds and lost creases; **rejected**. Provider metadata labels model`tripo-mesh-decimate` despite requested`remeshMode:retopology`; actual algorithm not independently known. Saved `art/vehicle-pipeline/magnific/corvette-retopo-10k`, provenance and five-angle solid review. Do not use as approved low. Astra continuing local surface cleanup/retopology.
- Corvette optimized asset, bakes, integration: pending shape review.
- Cobra, RAM, Stelvio, Lancer: pending, process sequentially after preceding car is integrated/validated.

## Agreed representation

Authoring metres, Blender Z up/−Y front; exported+Y up/+Z front. `BodySuspension`, `Suspension_FL/FR/RL/RR`, `Steering_FL/FR/RL/RR`, `Wheel_FL/FR/RL/RR`. Rigid body and wheel centers independent. Calipers follow steering, not spin.

Race target8–10k tris (Lancer6–8k), close garage16–22k, far2–4k. Race target9primitives: body atlas, four rolling wheels, four fixed calipers. Far may omit calipers. Two material families; tinted opaque glass can share body atlas when visually justified.

`public/models/optimized/{asset-id}/{garage,race,far}.glb` and actual baked maps. Body map neutral-white painted regions; masks Rpaint/Gbrake/Bglass. Wheel masks Rrim/Gtire. Tangent OpenGL normals; ORM linear. Basecolor sRGB, no baked reflections. UV0 unique for bake, mip padding. Shared image resources across clones, no per-car reflection capture.

Sources: user photos copied into art/vehicle-pipeline/references with checksums. Stelvio verified first-gen sources pending lookup.

## Audit findings before edits

Main `buildVehicle` currently calls `buildHeroVehicle` for the original five and `buildCollectionVehicle` for the50. The independent Corvette garage instead loads public/models/corvette-c7/corvette-c7.glb. These are divergent implementations. Current preloadVehicles is a no-op; race/garage factories are synchronous. RivalFleet instances geometry per primitive but has legacy paint/taillight shader assumptions; loading, ownership, shader masking and LOD must be integrated deliberately. Existing game handling dimensions are scaled miniature distances; preserve driving tuning and document any visual adaptation rather than silently changing physics.

## Root / Astra ownership

Astra: Corvette high refinement then low geometry/UV/bakes/export. Root: route/measurement audit, shared runtime/cache/LOD and integration, UI verification. Coordinate before editing other's files. All five must ultimately share the same production representations in garage/race, with camera-appropriate LOD.

## Runtime work in progress

`src/vehicle-lod.js`: camera projection in CSS pixels and race/far hysteresis. Three numerical tests pass (dead band, perspective/near plane, orthographic). Not yet connected to asset representations; thresholds require gameplay review. Existing game routes remain unchanged until optimized exports pass QA.

`src/vehicle-material.js`: masked paint/rim/brake shader, clone-safe uniforms and instance colors/braking; actual WebGL checks pass in `tools/vehicle-material-check.html`. Tire profile/tread options added afterward and need asset-specific visual checks.

`src/vehicle-assets.js`: lazy requested-quality cache, shared external texture loading and material ownership. Production registry intentionally empty until an asset passes validation. Factories, world disposal, async garage/race selection, player/rival/ghost LOD and one shared per-renderer PMREM now wired. `ProductionRivalFleet` uses compact per-LOD instance buckets and borrowed geometry wrappers; synthetic ownership/LOD/brake/color tests pass. Individual car poses preserve suspension offset and use individual wheel radii when authored. Race visual scale matches the existing handling wheelbase uniformly; garage stays metres. `src/corvette-model.js` adapts the independent showroom to the same optimized asset once registered; download expects garage-package.zip and skin-template.png. `scripts/vehicle-package-qa.mjs` measures package budgets/attributes/transformed bounds/pivots/textures and mip memory; not yet run on a finished production package.

Validation so far: Vite build passed before async garage changes. Ghost tests pass. Stale collection roster test corrected to5production+50collection; all9collection tests pass. Garage frame test still hits the pre-existing missing Stelvio factory. Async selected-only garage loading and race preloading now wired in main/garage; actual browser category change+Corvette selection passed without console errors. Actual GPU shader tests (including wheel shader) passed and saved in art/vehicle-pipeline/material-gpu-check.json. Full production integration remains unvalidated; do not report the pipeline complete.

Latest validation: Vite build passes after fleet/LOD implementation (one transient missing audio.js during concurrent unrelated work disappeared; file not changed by this task). Ghost8+production-fleet1 tests passed. Subsequent independent showroom adapter and per-wheel radius changes need final checks with the real exports.

## Latest review (2026-11-02)

First baked race candidate exports 9,867 triangles, 9 primitives, 2 material families and 535,580 geometry-GLB bytes. **Rejected pending corrections**: visible Boolean cylinder residue and bake/projection contamination on cabin and other regions. Astra is isolating corrected parts for rebaking and inspecting flat albedo separately from normals/reflections. No production registry activation. Actual race body maps are1K and wheel maps512; planned lower-resolution ORM/masks must be measured after export, not reported as achieved.

Masked tire width now also applies to shadow depth and translucent replay ghost materials, sharing source texture resources. Browser WebGL checks pass including both shader variants; ghost8 tests pass. Latest full suite:232/240 pass,8 failures (legacy C7 budget, missing Stelvio factory, and current circuit-selection UI expectations). Detailed log: `/tmp/roadrushers-vehicle-tests.log`. No unrelated UI changes attempted. Vite build passed before the last ghost material change; recheck at integration.
