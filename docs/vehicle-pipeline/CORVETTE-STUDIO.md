# Corvette study

The approved visual source is the segmented Tripo result [EbZlVU0uuO](https://www.magnific.com/app/creation/EbZlVU0uuO). Preserve that model's silhouette and proportions; the reference photographs are not CAD measurement data. Earlier continuous-source reconstructions are not the selected direction.

Open `/corvette-studio.html` on the development server. This is a standalone presentation prototype for a later garage. It does not register a new race asset or alter driving physics.

## Export contract

- `public/models/corvette-study/model.glb`, with `manifest.json` naming `model` and optionally `package`.
- Metres, +Y up, +Z front; ground contacts at Y=0.
- `BodySuspension`; each corner has `Suspension_FL/FR/RL/RR > Steering_FL/FR/RL/RR > Wheel_FL/FR/RL/RR`.
- Wheel local X is the axle, steering local Y is vertical. Wheel origins must be their actual centers.
- glTF material extras `vehicleRole`: `paint`, `rim`, `rubber`, `glass`, `trim`, `metal`, `brake`, `lights`.
- Solid material colors and an authored tangent-space normal atlas. No generated base-color, ORM, AO or emission images in this study package.
- Unique UVs for normal baking and user skins. Preserve normals/tangents through export.
- The study may use up to 40k triangles to retain the approved shape. The separate race representation still needs its own lower budget and validation.

## Presentation

The viewer builds a dark floor and a studio environment from large softboxes. PMREM is generated once at startup; there are no per-car or per-frame reflection probes. Gallery thumbnails are rendered from the actual loaded model once, not illustrative images.

The paint material uses shared normals and editable solid color/roughness/clearcoat. Uploaded skins stay local to the current page and are disposed on replacement. Rim color and tire appearance are independent. Ride height only moves the sprung body. Direction and wheel rotation operate on the exported hierarchy.

Vehicle engine figures in the sidebar come from the user's reference capture; they are not claimed as the game's driving balance. The inspection drawer measures triangle count, primitives, materials, normal maps and geometry typed-array memory from the actual loaded export.

## Verification

Run `node scripts/corvette-study-check.mjs` against the final package (`--draft` only for preliminary geometry checks). It checks the real GLB, rig convention, customization roles, indexed geometry, required normal attributes, texture types and complete RGBA8 mip memory. This numerical check does not replace multi-angle appearance review or actual WebGL interaction checks.

Build with `npm run build`. Review frontal, three-quarter, side and rear views, alternate paint colors, full steering, suspension, tire options and the wireframe. Final screenshots and package reports belong in `art/corvette-study/`. A successful build alone is not an approval of the asset.
