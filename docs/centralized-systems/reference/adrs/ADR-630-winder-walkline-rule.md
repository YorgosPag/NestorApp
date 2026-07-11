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

### Phase 2c — balanced "dancing" winders: spread inner ends (no point, no hole, no separate polygon)

> ⚠️ **Status: implementing — may need one more visual iteration** after Giorgio's
> on-screen checks (his explicit note, 2026-07-11). This section is the agreed
> target construction; the exact spread/seam math may be tuned in a follow-up.

**Findings (research — Revit / ArchiCAD / French drafting / US Patent 6,845,595):**
- Balanced/"dancing" winders are drawn so the risers **do NOT converge to one
  point** — each riser is **directed to a different point**; the inner (narrow) end
  is **broadened to a minimum width** (ΝΟΚ 130 mm, IRC 152 mm, UK 50 mm) so it
  never comes to a point.
- The **line of travel (walkline) is divided into EQUAL goings ≈ tread** (280 mm);
  the transition spreads over **as many treads as needed** to keep the walkline
  going near the straight tread — **not** a fixed cap.
- The corner is filled by the winder treads **themselves** — their inner boundary
  is the two flight inner edges meeting at P — so there is **no separate fill
  polygon and no hole**.

**Rejected attempt (Φ2c-newel, 2026-07-11):** stopping the arc risers on an `r_in`
circle plus a separate `newelCore` fill left a **central polygon** and kept the
risers **radial** (still converging on P). Giorgio rejected it: the centre must be
filled by the winders' own extensions, and the risers must spread. Reverted.

**Target construction (final):**
1. Turn region = last `k` treads of flight 1 + `W` winders + first `k` of flight 2
   → `M = W + 2k` balanced treads with **equal walkline going `g`** (walkline at
   `halfW` about P). `k` **auto-grows** (cap raised / removed) until `g ≈ tread`.
2. **INNER boundary = flight1 inner edge → P → flight2 inner edge** (the reflex L).
   Each riser's inner end `IN_j` is placed on this L, **spread symmetrically about
   P with minimum spacing `minInnerGoing`** (`resolveWinderMinimums`). The risers
   land at **different points** (never all on P); the two innermost meet at P, so
   the corner is filled by the winder treads. **No central polygon.**
3. Each riser = the line through its equal-going walkline mark `WL_j` and `IN_j`,
   extended to the OUTER boundary (flight outer edge → outer arc radius `width` →
   flight outer edge) → `OUT_j`. Risers are **skewed** ("directed to different
   points"); the walkline going stays equal.
4. Treads tile between consecutive risers `[IN_j, OUT_j, seam?, OUT_{j+1},
   IN_{j+1}]`; the corner-straddling tread carries P as its inner vertex.
   Adjacent flight treads (5,6,7… / 11,12,13…) become **trapezoidal** as the spread
   `k` grows — exactly what forces the "opening".

**Implementation plan:**
- `stair-winder-balanced-band.ts` — replace the radial-to-P inner ends
  (`sampleRiser` zone B `inner = P`) with **spread inner ends on the L**
  (`innerEndOnL(offset)`, offset `= (j − jMid)·minInnerGoing`); **remove**
  `newelCore` / `innerBoundaryRadius` / `buildNewelCore`. `minInnerGoing` stays
  (now the spread spacing, not a cut radius).
- `computeBalancedBandPlan` — **grow `k`** until `|g − tread|` is within tolerance
  (raise `MAX_BAND_STEPS_PER_SIDE`, bounded by the available flight treads), so the
  walkline going stays ≈ 280 and the trapezoidal transition spreads as far as needed.
- `stair-geometry-winder.ts` — drop the `newelCore` treads-append (revert Φ2c-newel).

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

- The corner "hole", the zero-going miter AND the sharp apex are all gone (Φ2f):
  the winder risers spread onto the flight-edge `L`, the two innermost meeting at
  `P`, so the treads fill the corner themselves — no hole, no newel void, no
  separate polygon.
- Every band riser passes through its **locked equal-going walkline mark** at `R*`
  (verified 0.0 mm off) — **no kinks, risers cross the line of travel cleanly**.
- Every step — straight flights **and** band — keeps a **uniform going = `tread`**:
  the walkline sits at `R* = W·tread/Θ`, so there is no going jump between the
  straights and the turn and the stair never spreads. When `R* > width/2` (narrow
  stair) the walkline clamps to the centre radius → best-effort going (`< tread`).
- The face/riser rotation is **spread gradually** over several "dancing" treads
  (Φ2g): the inner-edge going ramps in equal increments from `minInnerGoing` at the
  corner out to ~`tread` at the flights, so there is **no abrupt miter** at the
  band↔flight junction. The number of transition treads (`k`) is derived from a
  closed form so the ramp naturally ends on the tread; the going on the line of
  travel stays uniform `tread` throughout.
- The balance is **geometric** (applies for every profile incl. `'none'`); the
  code minimum stays a validator warning only.
- The band is footprint-preserving → labels (`stepCount` unchanged), stringers
  and the geometric walkline are unaffected.

### Known limitation (follow-up)

The band outer edges are anchored chords (not the smooth arc) so the outer tread
edges may show tiny scallops vs the outer stringer. Winder treads are still
**wedges** (deeper toward the outside) — inherent to every winder; "uniform" means
uniform going on the line of travel, not identical polygons. On a **narrow** stair
(`R* > width/2`) the going stays `< tread` (clamped). The centre-derived inner
stringer keeps its arc **cusp** (pre-existing follow-up — explicit winder stringers).

## Testing

- `stair-winder-balanced-band.test.ts` — `computeBalancedBandPlan` (auto-`k`) +
  **Φ2f balanced fill** (inner end on P → corner filled, ≥ minInnerGoing narrow-end
  spacing, minInnerGoing 0 → feet on P, count conserved) + **uniform going**
  (`resolveBandWalklineRadius` R*/clamp, wide stair → going == tread & band k=1,
  narrow clamp → going < tread, pure flights advance by tread) + **Φ2g graduated
  ramp** (shape-driven `k` closed form, grows past the going-driven `k`, takes the
  wider of the two, minInnerGoing 0 → legacy `k`; inner going ramps — not a flat
  plateau — corner going ≈ min, corner still filled, no degenerate tread).
- `stair-winder-walkline-rule.test.ts` — mm/scene resolver + `winderWalklineWarnings`.
- Regression: `StairGeometryService-winder` / `-lshape-winders` — band reaches P
  (no hole), pure flights rectilinear, count conserved.
  Full stairs dir: **316/316 green**. jscpd: clean.

## Changelog

- **2026-07-11** — Phase 2g (**graduated inner-going ramp**, DONE — Giorgio's
  order): visual check of Φ2f (σκάλα Γ, 1200/280/W3/90°) showed a near-**miter** at
  the inner corner — the face/riser rotation collapsed into a **single** transition
  tread per side (`k = 1`), because at `R*` the equal going is `tread` for **any**
  `k`, so the going-tolerance loop closed `k` at its minimum. Two coupled fixes, both
  in existing SSoT functions (no duplicates):
  1. **`computeBalancedBandPlan` — shape-driven `k`.** Decouple `k` from the going
     (which is already uniform): grow it so the rotation spreads over enough "dancing"
     treads. Closed form (unit-safe, no magic mm constant): the band inner going
     averages `2k·t/(W+2k)`; a symmetric ramp with the corner gap at `minInnerGoing`
     lands its outer gap on `tread` when `k = W·(t+minInnerGoing)/(2·(t−minInnerGoing))`
     (`shapeStepsPerSide`). The wider of {going-driven, shape-driven} `k` wins, bounded
     by `n1−1, n2−1, MAX_BAND_STEPS_PER_SIDE`. σκάλα Γ → `k = 4` (band 11, steps 4–14).
     `walklineGoing` stays `tread` (going(k)=tread at `R*`) → **Φ2f uniform going
     untouched**.
  2. **`computeInnerOffsets` — symmetric V-ramp** (replaces the flat `minInnerGoing`
     plateau + the earlier per-side `fillRampSide`). The inner GOINGS form a symmetric
     **V**: `minInnerGoing` at the corner, rising in **equal increments** to ~`tread`
     at each flight junction. The slope follows from the whole-edge sum constraint
     (`Σ gaps = 2·bandTail`), so the ends land EXACTLY on `±bandTail` and the rotation
     spreads SMOOTHLY over EVERY band tread (no plateau, no overshoot). `minInnerGoing =
     0` → legacy fan untouched. Measured σκάλα Γ ramp:
     `280 | 265 238 211 184 157 [P] 157 184 211 238 265 | 280`.

  **Φ2g visual fixes (same day, iterated on Giorgio's right-turn screenshots):**
  - **Seam protrusion** — the last straight-tail outer end extended PAST the arc
    tangent (`(-600,2092)` vs tangent `(-600,1925)`), poking a spike out past the outer
    edge. Fix: at the zone boundaries (`j === k`, `j === m − k`) the outer end is
    **snapped to the tangent point** `t1Outer`/`t2Outer` (on both flight edge AND width
    circle) instead of the extended line.
  - **Rotation not spread / odd-`W` asymmetry** — a first attempt (per-side ramp +
    cap at `tread`) flattened the outer transition treads (rotation bunched at the
    corner) and, because `W = 3` is odd, split the band `5|6` so one side overshot.
    Fix: the **symmetric V-ramp** above + a **parity-aware corner**: for an ODD tread
    count the MID tread is **bent through `P`** (extra apex vertex → a pentagon), so the
    ramp is perfectly symmetric and the corner is still filled (no hole); for an EVEN
    count a mark lands on `P` (two treads meet). Corner going = `minInnerGoing` (the two
    innermost ends flank `P` at `±minInnerGoing/2`).

  Tests: `+10` Φ2g total (shape-`k`, ramp not-flat, no-overshoot, tangent-locked-no-
  protrusion, corner going `=min`, mid-tread-bent-through-P, no degenerate). Full stairs
  dir **318/318 green**, jscpd clean.
- **2026-07-11** — Phase 2f (**locked marks + spread fill to P**, DONE — Giorgio's
  construction, supersedes Φ2e radial+newel): visual check of Φ2e showed the radial
  fan left a **newel void** ("hole") at the corner. Giorgio's fix: **lock** the
  equal-going walkline marks at `R*` (the "blue" crossings where walkline = riser =
  tread face) and **rotate** each riser around its mark so its inner end spreads
  onto the reflex flight-edge `L`, the two innermost meeting at **P** → the corner
  is filled by the winders' own treads (no hole, no newel, no separate polygon).
  EVERY band riser passes through its locked mark: the (inner → mark) ray is
  extended to the outer boundary (`extendToCircle` on the arc, `extendToLine` on the
  straight tails) — verified 0.0 mm off-walkline for all band risers; going stays
  uniform `tread` on the `R*` walkline. `k` auto-grows (`computeBalancedBandPlan`)
  so the spread fades over the borrowed transition treads. One-file geometry change
  (`stair-winder-balanced-band.ts`: `buildBand` + `spreadInnerEnds` restored, new
  `walklineMark`/`extendToCircle`/`extendToLine`; `resolveNewelRadius`/radial fan
  dropped). Tests 308/308, jscpd clean. Pending: Giorgio visual verify.
- **2026-07-11** — Phase 2e (**radial + newel**, superseded by Φ2f): supersedes the Φ2c/Φ2d
  "dancing spread"): after Φ2d, Giorgio's visual check showed (1) the corner treads
  still read deeper and (2) the drawn walkline had **kinks the risers did not pass
  through**. Root cause (found by dumping the real geometry): the Φ2c *spread* inner
  ends made the winder risers **non-radial**, so they crossed the centre walkline
  ~65 mm off the equal-going marks; and Φ2d moved only an **invisible** going radius,
  leaving the drawn walkline at the centre (going 314 on the arc). Fix (Giorgio chose
  "radial + newel"): the winder risers are **RADIAL** through `P` at equal
  `Δθ = turnRad/W`, their inner ends stopping at a **newel radius** `r_n =
  minInnerGoing/Δθ` (narrow-end going = code min; no zero-width apex, no separate
  polygon, no hole); the **drawn** walkline sits at `R* = W·tread/Θ` so radial risers
  land exactly on it (no kinks) and every step keeps a uniform going = `tread`.
  Stringers stay derived from the **centre** walkline (unchanged edges, no
  regression). One-domain change: `stair-winder-balanced-band.ts`
  (`buildBalancedWinderRun` → radial fan, `resolveNewelRadius`, drops the band /
  `spreadInnerEnds` / `sampleOuter`), `stair-geometry-winder.ts` (`buildWinderWalkline`
  radius param + display-vs-centre split, explicit stringers),
  `stair-geometry-generators.ts` (`assembleMultiFlight` optional `stringers`). Tests
  300/300 green, jscpd clean. Note (Giorgio): newel `r_n` is code-sized (~248 mm for
  ΝΟΚ/1200) — may want to tune smaller after his visual check.
- **2026-07-11** — Phase 2d (**option C — UNIFORM going**, superseded by Φ2e): every step —
  straight flights **and** band — keeps a **uniform going = `tread`**, so the σκάλα Γ
  no longer shows the ~8 mm deeper band (steps 6-11) next to the 280 straights.
  Root cause: the equal going was measured at the **centre** radius `width/2`, where
  the fixed quarter-arc (`R·Θ`) over `W` winders gives `> tread` (e.g. 1200/280/W3 →
  287.9 ≠ 280). Fix: measure the going on the **balanced-winder walking line** (DIN
  Lauflinie) at `R* = W·tread/Θ`, the radius where the winder going equals the
  straight tread → `(2k·t + R*·Θ)/(W+2k) = t` for any `k`, so the going is uniform
  and `k` collapses to its minimum (no flight spread, stair length unchanged).
  `R*` is clamped to `width/2` when the turn is too wide / too few winders to reach
  `tread` inside the stair (narrow stair → best-effort centre going, legacy). The
  physical outer edges (straight `width/2`, arc `width`) and the drawn walkline /
  stringers / handrails (centre-derived) are **untouched** — only the going-reference
  radius moves inward. One file: `stair-winder-balanced-band.ts` (new
  `resolveBandWalklineRadius`; `buildBand`/`sampleOuter` take the walkline radius).
  Research: US Patent 6,845,595, DIN 18065 balanced-winder Lauflinie, Revit
  "Minimum vs Actual Tread Depth". Approved by Giorgio (option C). Note: may need
  one more visual iteration on the band **shape** (k now minimal) after his checks.
- **2026-07-11** — Phase 2c (**target, implementing**): **balanced "dancing"
  winders — spread inner ends**. Risers directed to **different points** (not P),
  inner ends spread on the flight-edge L with min spacing `minInnerGoing`, corner
  filled by the winders' own extensions (**no central polygon, no hole**); `k`
  grows so the equal walkline going stays **≈ tread**; adjacent flight treads go
  trapezoidal as far as the spread reaches. Research-backed (Revit/ArchiCAD/French
  method, US Patent 6,845,595). *Supersedes the intra-day **Φ2c-newel** attempt
  (`r_in` circle + separate `newelCore` appended to `treads`) — rejected by Giorgio
  (left a central polygon, risers still radial); reverted.* Note (Giorgio): may
  need one more visual iteration after his checks. Hover perimeter-outline cusp at
  the winder corner stays a separate follow-up.
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
