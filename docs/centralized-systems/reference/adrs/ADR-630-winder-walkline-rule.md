# ADR-630 — Winder walkline rule (SSoT for direction-changing stairs)

- **Status:** Accepted
- **Date:** 2026-07-10
- **Related:** ADR-358 (stair tool), ADR-611 (stair geometry generators SSoT), ADR-619 (stair from region)
- **Domains:** `bim/geometry/stairs`, `services/building-code`

## Context

When a stair turns **without a landing**, the corner steps ("winders" /
σκαλοπάτια κουρμπαριστά) fan out from the inner pivot. The pre-ADR-630 geometry
(`buildWinderTreads`) emitted each winder as a bare triangle `[apex, outerA,
outerB]` with the apex sitting exactly on the pivot — i.e. **zero going at the
inner edge**, the dangerous "miter" that every building code forbids.

Two facts made this worse:
- `StairParams.walklineOffset` existed (doc-commented "default 300") but was
  **dead code** — never read anywhere. Its default was a misleading `600`
  (= width/2 for a 1200 stair).
- The stair validator (`gate-stair-checker.ts`) only checked the flat
  `params.tread` — **no check** measured the going at a winder corner.

The building-code rule (IRC R311.7.5.2.1 / ΝΟΚ Άρθρο 13 / DIN 18065) is:
1. **Minimum going at the narrow inner end** — the apex is cut back so the going
   along the inner arc never drops below the code minimum (≈152 mm IRC, ≈130 mm
   NOK). The wedge becomes a **trapezoid**, never a spike.
2. **Minimum going at the walkline** — measured on a line offset ~300 mm from the
   inner edge (where a person treads); must stay ≥ the code minimum (≈254 mm
   IRC, ≈250 mm NOK), else a warning fires.

## Decision

Introduce a single SSoT module
**`bim/geometry/stairs/stair-winder-walkline-rule.ts`** owning both rules for
**every** direction-changing stair, and wire the existing consumers to it.

### The module

**Phase 2 supersedes the Phase-1 "inner-radius cut" with the balanced /
dancing-winder construction** (Revit default, continental-EU / ΝΟΚ practice).
Cutting the wedges to a `minInnerGoing` radius left a visible **hole** at the
corner and the treads no longer reached the inner corner P — rejected. The
balanced construction keeps equal walkline going *and* fills to P.

- `WINDER_CODE_MINIMUMS_MM` — per-`StairCodeProfile` mm table (nok/ibc/eurocode/
  nbc/nfpa/as1657/din/ada/none). `none` = `0` → validator warning disabled.
- `resolveWinderMinimums(codeProfile, sampleWidth)` — scales the mm table into
  the caller's unit system by keying off the `width` magnitude
  (`inferSceneUnitsFromWidth` + `mmToSceneUnits`, the units SSoT — **no**
  `mmFactorFromWidth` clone). Serves both the scene-unit geometry pipeline
  **and** the mm-normalised validator.
- `computeBalancedWinderRule(input)` — pure, unit-agnostic. Given
  `{ turnRad, winderCount W, tread, walklineRadius R = width/2 }` returns
  `{ winderSweepRad, startAngleRad, encroachRad δ, walklineGoing g, bandStepsPerSide }`.
  - Equal walkline going across the band (W wedges + 1 transition tread per
    side): `g = (2·tread + R·Θ) / (W + 2)`.
  - Wedge sweep `φ = g/R`; the fan spans `W·φ` centred on Θ, encroaching
    `δ = (W·φ − Θ)/2` into each flight (δ>0 = wedges steal from flights on a
    narrow stair; δ<0 = wedges give on a wide stair — both tile cleanly).
- `winderWalklineWarnings(rule, minWalklineGoing)` — validator warning: fires
  `winder-walkline-going-below-min` when the equal going `g` is below the code
  minimum. The inner tip reaching P is **intentional RC fill**, not flagged.
- `radialEdgeIntersect(pivot, dir, edgePt, edgeDir)` — lands a wedge / trapezoid
  outer vertex exactly on a straight flight edge so the corner tiles with no
  sliver (the wedges and the transition trapezoids share the P→outer edge).
- `buildWinderWedge(...)` — retained wedge builder (triangle when `innerRadius ≈
  0`); still exported for future reflex-arc consumers.

### Consumers wired

| Consumer | File | Change |
|---|---|---|
| Winder kind **+** L-shape-with-winders (σκάλα Γ) | `stair-geometry-winder.ts` | `assembleWinderRun` computes the balanced rule + `computeJunctionOuters` once; `buildWinderTreads` emits W triangles reaching P; `buildWinderFlight1/2` reshape the flight-end treads into transition trapezoids sharing the P→outer edge. Both variants share `assembleWinderRun` → both fixed at once. |
| Code validator | `gate-stair-checker.ts` | `checkWinderGeometry` uses `computeBalancedWinderRule` + `winderWalklineWarnings` → the equal-going warning folds into `codeViolations` (universal except `'none'`). |
| Walkline default | `stair-completion.ts` | `DEFAULT_WALKLINE_OFFSET_MM` fixed `600 → 300` (Phase 1, retained). |

### Scope note

The **geometric walkline** (`buildWinderWalkline`, used for stringers/handrails)
is intentionally **left at width/2** — moving it would break stringer offsets.
The balancing uses that same `R = width/2` arc as its going-measurement line.

## Consequences

- The corner "hole" and the zero-going miter are both gone for the σκάλα Γ and
  the winder kind: the wedges fill to P and the two flight-end treads become
  balanced transition trapezoids sharing their edges with the wedges.
- Every band tread (wedges + 2 transitions) keeps **equal walkline going** → the
  turn is uniform and gradual (no abrupt going jump) — the Revit/textbook
  "balanced/dancing" result.
- The balance is **geometric** (applies for every profile incl. `'none'`); the
  code minimum stays a validator warning only.
- The rule is generic: future consumers (stair-from-region reflex arcs,
  gamma-with-winders) call the same `computeBalancedWinderRule` — no re-derivation.

### Known limitation (follow-up)

The band is fixed at **1 transition tread per side** (`bandStepsPerSide = 1`).
Spreading the turn over more steps (Revit "wider balance", `k ≥ 2`) needs swung —
not purely radial — risers and flight-tread repositioning; deferred to a
follow-up. With `k = 1` the equal going already stays within a few mm of the
straight tread for typical stairs, so the visible transition is smooth.

## Testing

- `stair-winder-walkline-rule.test.ts` — balanced rule solver (equal going, δ
  sign both ways, cw/ccw mirror, degenerate), `winderWalklineWarnings`,
  `radialEdgeIntersect`, mm/scene resolver, wedge shape + winding.
- Regression: `StairGeometryService-winder` / `-lshape-winders` assert wedges
  reach the shared pivot apex (no hole) + flight-end transition trapezoids.
  Full stairs dir: **268/268 green**. jscpd: clean.

## Changelog

- **2026-07-10** — Phase 2: **balanced / dancing winders**. Replaced the Phase-1
  inner-radius cut (`computeWinderWalklineRule`) with `computeBalancedWinderRule`
  — wedges reach the inner corner P (no hole), the two flight-end treads become
  equal-going transition trapezoids, corner tiles via shared P→outer edges
  (`computeJunctionOuters` + `radialEdgeIntersect`). Validator switched to
  `winderWalklineWarnings`. Fixed at `bandStepsPerSide = 1` (k≥2 wider balance =
  follow-up). Pending: browser verification of the render; stair-from-region
  reflex-arc + gamma-with-winders consumers.
- **2026-07-10** — Phase 1: SSoT module + geometry wiring (winder kind &
  L-shape-with-winders) + validator check + i18n (el/en) + `walklineOffset`
  default fix. *Superseded by Phase 2 (the cut left a corner hole).*
