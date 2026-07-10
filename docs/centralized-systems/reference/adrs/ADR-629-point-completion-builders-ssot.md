# ADR-629: Point-placement completion builder SSoT (`hooks/drawing`)

## Status
✅ **ACTIVE — 2026-07-10** — Cluster #19 of the jscpd de-duplication sweep (ADR-584 / N.18), targeting `src/subapps/dxf-viewer/hooks/drawing/`. The two byte-identical skeletons repeated by every single-click point-placement `*-completion.ts` collapsed onto one new SSoT — with **identical public APIs** and **1:1 behaviour**.

**Related:**
- **ADR-600** — `create-single-click-placement-tool.ts` (`PlacementBuildResult<TEntity>`, the pre-existing `build{X}Entity` result contract adopted here rather than re-declared).
- **ADR-408 / ADR-406 / ADR-410 / ADR-415 / ADR-430–434** — the point-placement BIM entities (boiler, radiator, manifold, water-heater, electrical-panel, MEP fixture, furniture, floorplan-symbol) whose completion builders are centralised.
- **ADR-626** — cluster #17 (same sweep, same directory: `usePolygonAreaTool` for closed-area tools). **ADR-628** — cluster #18 (`hooks/data` persistence). **ADR-627** — hatch grip parity (unrelated, concurrent).
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28 / N.18) — gated the iteration; `jscpd:diff` clean on all touched files, no `SKIP_JSCPD_DIFF`.

---

## Context

A real SSoT audit (fresh jscpd pass grouping `hooks/drawing` at **516 cloned lines / 41 intra-dir pairs**, plus full reads of all eight completion modules AND the existing `create-single-click-placement-tool.ts`) found that every single-click point-placement completion module repeated **two byte-identical skeletons**:

1. **`build{X}Entity(params, layerId)`** — `validate → compute geometry → create`, short-circuiting on hard errors. **Byte-for-byte identical** across all eight modules (boiler / radiator / manifold / water-heater / electrical-panel / fixture / furniture / floorplan-symbol); the ONLY variance is the three injected functions `validate*Params` / `compute*Geometry` / `create*`.
2. **`buildDefault{X}Params` prologue** — for the rectangular body-placement family (boiler / radiator / water-heater / manifold / electrical-panel): the `overrides.X ?? DEFAULT` footprint/pose resolution + `position = { x, y, z: 0 }` + `rotation ?? 0`. Boiler ⇄ radiator additionally shared their entire `base` params-assembly block (kind/shape/connectorDiameterMm + `thermalOutputW`/`material` omit-if-undefined spreads) byte-for-byte.

The result contract was **already** declared canonical: `create-single-click-placement-tool.ts` exports `PlacementBuildResult<TEntity>` with the jsdoc *"`build{X}Entity` result contract — shared by every completion module"* — yet each module re-declared its own `Build{X}EntityResult` union instead of adopting it (the same *adopt-existing* gap as cluster #17/#18).

**NOT in scope** (N.1 — divergent behaviour): the `buildDefault*Params` prologues that genuinely branch — `mep-fixture` (per-kind `resolveFixtureKindDefaults` over ~10 fixture families), `mep-manifold` (drainage-collector vs water-manifold dimension/connector branching), `furniture` / `floorplan-symbol` (footprint from a catalog preset, `widthMm`/`depthMm`/`rotationDeg` naming). Those keep their bespoke `buildDefault` bodies and adopt only the entity-build skeleton.

---

## Decision

Extract one SSoT module and migrate all eight completions to thin bindings; keep every public function name, param/result shape (`Build{X}EntityResult` preserved as an alias), and observable geometry/validation/factory effect unchanged.

### `point-completion-builders.ts` — three primitives

- **`buildBimPointEntity<TParams, TGeometry, TEntity>(params, layerId, spec)`** — the single implementation of the `build{X}Entity` skeleton. `spec = { validate, computeGeometry, createEntity }`; returns the adopted `PlacementBuildResult<TEntity>`. Every `create{X}` factory is structurally assignable to the `createEntity` slot, so the factory reference is passed directly (no wrapper, no `as any`). Adopted by **all eight** modules; each `Build{X}EntityResult = PlacementBuildResult<{X}Entity>`.
- **`resolveBodyPlacement(clickPoint, overrides, defaults)`** — the shared footprint/pose prologue (`overrides.X ?? default` per dimension, `rotation ?? 0`, `position` at floor level). Adopted by the five body-placement completions. Each module's `*ParamOverrides` now `extends BodyPlacementParamOverrides` (width/length/bodyHeightMm/mountingElevationMm/rotation/material inherited), declaring only its own kind/shape/extra fields.
- **`assembleMepApplianceBodyParams<TKind, TShape>(kind, shape, placement, sceneUnits, extras)`** — assembles the shared params object for a connector-diameter MEP appliance (boiler / radiator / water-heater), omitting undefined optional fields (`thermalOutputW` / `tankCapacityL` / `material`) so params stay Firestore-clean. Collapses the boiler ⇄ radiator base-assembly twin; the caller layers its derived `connectors` on top.

Migration outcome per module:
- **boiler / radiator** → `resolveBodyPlacement` + `assembleMepApplianceBodyParams` + `buildBimPointEntity`.
- **water-heater** → same, with `tankCapacityL` extra.
- **electrical-panel** → `resolveBodyPlacement` + `buildBimPointEntity` (kind-aware connectors kept inline).
- **manifold / fixture / furniture / floorplan-symbol** → `buildBimPointEntity` only (bespoke `buildDefault` kept, N.1).

---

## Consequences

- **One SSoT owns the build/resolve skeletons.** A change to the validate→geometry→create contract, or the footprint-resolution rule, happens once.
- **Public API unchanged.** All `build{X}Entity` / `buildDefault{X}Params` names + signatures preserved; `Build{X}EntityResult` kept as aliases. External consumers (3D placement ghosts, ghost-preview hooks, `hooks/grips/grip-parametric-copy`, ~15 tests) untouched.
- **No `any` / `as any` / `@ts-ignore`.** The primitives are fully generic; factory references pass directly into the `createEntity` slot by structural assignability.
- **Clone reduction:** `hooks/drawing` **516 → 478 cloned lines / 41 → 40 intra-dir pairs**; dxf-viewer total **1443 → 1440**; zero residual clones among the eight completion modules; the new module is itself clone-free. Full-scan ratchet **3494 baseline → 3260** working-tree (concurrent with cluster #18 + ADR-627). `jscpd:diff` clean on all nine touched files, no `SKIP_JSCPD_DIFF`.
- **Tests:** new `point-completion-builders.test.ts` (skeleton happy/refuse paths + `resolveBodyPlacement` default/override/explicit-zero matrix); parity re-verified across the four completion suites + the MEP boiler/radiator/water-heater/manifold/fixture geometry + mesh suites (all green).

---

## Changelog
- **2026-07-10** — Created. Cluster #19 of the jscpd sweep. New `point-completion-builders.ts` (`buildBimPointEntity` + `resolveBodyPlacement` + `assembleMepApplianceBodyParams`, adopting `PlacementBuildResult`); eight `*-completion.ts` migrated to thin bindings; new unit test; ADR + adr-index + memory pointer.
