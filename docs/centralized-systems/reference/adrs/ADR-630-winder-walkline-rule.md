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

Introduce SSoT modules under `bim/geometry/stairs/` owning the balanced
construction for **every** direction-changing stair — the geometry in
**`stair-winder-balanced-band.ts`** and the code minimums/warning in
**`stair-winder-walkline-rule.ts`** — and wire the existing consumers to them.

### The modules

**Phase 2 supersedes the Phase-1 "inner-radius cut" with the balanced /
dancing-winder construction** (Revit default, continental-EU / ΝΟΚ practice).
Cutting the wedges to a `minInnerGoing` radius left a visible **hole** at the
corner and the treads no longer reached the inner corner P — rejected. Two
modules split the concern:

**`stair-winder-walkline-rule.ts`** — code minimums + validator warning only:
- `WINDER_CODE_MINIMUMS_MM` — per-`StairCodeProfile` mm table (nok/ibc/eurocode/
  nbc/nfpa/as1657/din/ada/none). `none` = `0` → validator warning disabled.
- `resolveWinderMinimums(codeProfile, sampleWidth)` — scales the mm table into
  the caller's unit system by keying off the `width` magnitude
  (`inferSceneUnitsFromWidth` + `mmToSceneUnits`, the units SSoT — **no**
  `mmFactorFromWidth` clone). Serves both the scene-unit geometry pipeline
  **and** the mm-normalised validator.
- `winderWalklineWarnings(walklineGoing, minWalklineGoing)` — fires
  `winder-walkline-going-below-min` when the equal going is below the minimum.
  The inner tip reaching P is **intentional RC fill**, not flagged.

**`stair-winder-balanced-band.ts`** — the balanced geometry (SSoT):
- `computeBalancedBandPlan({ turnRad, winderCount W, tread, walklineRadius R =
  width/2, n1, n2 })` → `{ bandStepsPerSide k, walklineGoing g, totalBandSteps M }`.
  The turn region = the last `k` treads of flight 1 + `W` winders + the first `k`
  of flight 2, rebuilt as `M = W + 2k` treads that all share equal walkline going
  `g = (2·k·t + R·Θ)/(W + 2k)`. `k` **auto-widens** 1→2 (cap
  `MAX_BAND_STEPS_PER_SIDE`) while `g` is >3 % off the straight tread — the
  "spread the turn onto steps 6 & 12" case; `k = 0` (short flights) → pure fan
  `R·Θ/W`, still reaching P.
- `buildBalancedWinderRun(input)` — the full run (pure flight 1 + band + pure
  flight 2). The band walkline (straight tail + arc about P + straight head) is
  cut at equal-going marks; each riser is ⟂ to the walkline tangent and spans the
  inner boundary (flight edge → **P** → flight edge) to the outer boundary (flight
  edge → circle radius `width` → flight edge). Risers **swing gradually** from
  perpendicular to radial → dancing steps; the arc risers pass through P → wedges
  fill the corner (no hole). The band occupies exactly the footprint of the
  `k+W+k` treads it replaces → the pure flights are untouched (zero ripple).

### Phase 2c — newel / min-inner boundary (no acute miter, no hole)

Phase 2b reached the pivot P but the arc wedges converged to an **acute
zero-going miter** — Giorgio rejected it (2026-07-11 screenshot). Phase 2c adopts
the big-player construction (Revit **"Minimum Width on Inside Boundary"**,
ArchiCAD newel): the arc risers stop on a small inner circle instead of P, and the
central polygon is filled solid.

- **`BalancedBandInput.minInnerGoing`** — the code narrow-end going
  (`resolveWinderMinimums(codeProfile, width).minInnerGoing`, ΝΟΚ 130 mm), in
  `width`'s units. `0` (profile `none`) → legacy reach-P apex (full back-compat).
- **Inner boundary radius** `r_in = minInnerGoing · halfW / g` (`innerBoundaryRadius`):
  in the arc the risers are radial with equal walkline going `g` at radius `halfW`,
  so the going at radius `r` is `r·g/halfW`; solving for `minInnerGoing` gives
  `r_in`. Capped at `0.98·halfW`. The arc riser inner end moves from `P` to
  `P + ray·r_in` → the wedges become **trapezoids** (narrow end = `minInnerGoing`,
  no acute tip).
- **`newelCore`** (`buildNewelCore`) — the filled sector bounded by the two flight
  inner edges, the two transition chords and the `r_in` arc; every edge shared with
  a band tread or the stair outline (watertight). `null` when `r_in ≈ 0`.
- **Render channel** — the core is **appended to the `treads` list past
  `Σ flightSplit`** (in `assembleWinderRun`), NOT to `landings`: the 2D
  `StairRenderer` fills only `treads*Cut`, and `buildTreadLabels` stops at
  `Σ flightSplit` so the core stays **unnumbered** (winder steps 1..N intact). 3D
  `StairToThreeConverter` extrudes it as a corner slab. Result: no hole, no acute
  miter, corner filled up to P, numbering unchanged.

### Consumers wired

| Consumer | File | Change |
|---|---|---|
| Winder kind **+** L-shape-with-winders (σκάλα Γ) | `stair-geometry-winder.ts` | `assembleWinderRun` delegates the whole turn to `buildBalancedWinderRun`; `flightSplit = [n1−k, M, n2−k]`. Both variants share `assembleWinderRun` → both fixed at once. `rotateVec` centralised to `stair-geometry-shared.ts`. |
| Code validator | `gate-stair-checker.ts` | `checkWinderGeometry` uses `computeBalancedBandPlan` (unconstrained flights) + `winderWalklineWarnings` → the equal-going warning folds into `codeViolations` (universal except `'none'`). |
| Walkline default | `stair-completion.ts` | `DEFAULT_WALKLINE_OFFSET_MM` fixed `600 → 300` (Phase 1, retained). |

### Scope note

The **geometric walkline** (`buildWinderWalkline`, used for stringers/handrails)
is intentionally **left at width/2** — moving it would break stringer offsets.
The balancing uses that same `R = width/2` arc as its going-measurement line.

## Consequences

- The corner "hole" and the zero-going miter are both gone for the σκάλα Γ and
  the winder kind: the band fills to P and the turn tiles cleanly.
- Every band tread keeps **equal walkline going** and the risers swing gradually
  → the turn is uniform and smooth (no abrupt going jump) — the Revit/textbook
  "balanced/dancing" result. `k` auto-widens onto the neighbouring steps when the
  turn is tight.
- The balance is **geometric** (applies for every profile incl. `'none'`); the
  code minimum stays a validator warning only.
- The band is footprint-preserving → labels (`stepCount` unchanged), stringers
  and the geometric walkline are unaffected.

### Known limitation (follow-up)

`k` is capped at **2** transition treads per side (`MAX_BAND_STEPS_PER_SIDE`) — it
covers the "steps 6 & 12" case and keeps the result predictable. Raising the cap
is a one-constant change; the construction already generalises to any `k`. A tiny
tangent-corner approximation at the straight↔arc seam (sub-mm for real dims) is
absorbed by an inserted seam vertex.

## Testing

- `stair-winder-balanced-band.test.ts` — auto-`k` plan (equal going, widen-to-
  tolerance, `k=0` fallback, degenerate) + assembled run (tread count, wedges
  reaching P = no hole, contiguous z, cw/ccw mirror).
- `stair-winder-walkline-rule.test.ts` — mm/scene resolver + `winderWalklineWarnings`.
- Regression: `StairGeometryService-winder` / `-lshape-winders` assert the band
  reaches the shared pivot P (no hole), pure flights rectilinear, count conserved.
  Full stairs dir: **268/268 green**. jscpd: clean.

## Changelog

- **2026-07-11** — Phase 2c: **newel / min-inner boundary** (no acute miter, no
  hole). `BalancedBandInput.minInnerGoing` (from `resolveWinderMinimums`) drives
  `r_in = minInnerGoing·halfW/g`; arc riser inner end moves `P → P+ray·r_in`
  (`innerBoundaryRadius`) → trapezoidal wedges. `buildNewelCore` fills the central
  sector; `assembleWinderRun` **appends it to `treads` past `Σ flightSplit`** (the
  only channel the 2D `StairRenderer` fills) so it renders as corner fill (+3D
  slab) while staying **unnumbered**. `codeProfile 'none'` → `r_in=0` → legacy
  reach-P (back-compat). Tests: `stair-winder-balanced-band` (+5 newel cases),
  `StairGeometryService-lshape-winders` Test 4b (nok integration). **283/283 stairs
  + 10 renderer/converter green**, jscpd clean. Pending: browser verify + the
  **hover perimeter outline** at the winder inner corner (inner stringer =
  `offsetPolyline(walkline,−halfW)` collapses at the arc where offset = curvature
  radius → cusp; pre-existing, separate follow-up).
- **2026-07-11** — Phase 2b: **auto-widening balanced band (dancing steps, k≥2)**.
  New SSoT `stair-winder-balanced-band.ts`: `computeBalancedBandPlan` (auto `k`,
  cap 2) + `buildBalancedWinderRun` (equal-going marks, swung risers, wedges reach
  P, footprint-preserving). `stair-geometry-winder.ts` delegates the whole turn;
  the k=1-only helpers (`buildWinderTreads`/`buildWinderFlight1/2`/
  `computeJunctionOuters`/`buildWinderWedge`/`radialEdgeIntersect`/
  `computeBalancedWinderRule`) removed. Rule module trimmed to minimums +
  `winderWalklineWarnings`. `rotateVec` centralised to `stair-geometry-shared.ts`.
  Validator uses `computeBalancedBandPlan`. Pending: browser verification.
- **2026-07-10** — Phase 2: balanced winders, k=1 (wedges reach P + 2 transition
  trapezoids). *Generalised by Phase 2b to auto k≥2.*
- **2026-07-10** — Phase 1: SSoT module + geometry wiring + validator + i18n +
  `walklineOffset` default fix. *Superseded (the cut left a corner hole).*
