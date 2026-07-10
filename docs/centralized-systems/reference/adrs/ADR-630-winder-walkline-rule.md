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

- `WINDER_CODE_MINIMUMS_MM` — per-`StairCodeProfile` mm table (nok/ibc/eurocode/
  nbc/nfpa/as1657/din/ada/none). `none` = `0` → rule disabled (legacy triangle).
- `resolveWinderMinimums(codeProfile, sampleWidth)` — scales the mm table into
  the caller's unit system by keying off the `width` magnitude
  (`inferSceneUnitsFromWidth` + `mmToSceneUnits`, the units SSoT — **no**
  `mmFactorFromWidth` clone). This is what lets the SAME rule serve the
  scene-unit geometry pipeline **and** the mm-normalised validator.
- `computeWinderWalklineRule(input)` — pure, unit-agnostic. Returns
  `{ innerRadius, walklineRadius, innerGoing, walklineGoing, warnings }`.
  - `innerRadius = minInnerGoing / sweep`, capped at `0.9 · outerRadius`
    (warns `winder-inner-going-below-min` when it cannot fit).
  - `walklineRadius = innerRadius + walklineOffset`, clamped inside the tread
    (warns `winder-walkline-offset-clamped`).
  - warns `winder-walkline-going-below-min` when `walklineRadius · sweep` is
    below the code minimum.
- `buildWinderWedge(pivot, rayA, rayB, innerRadius, outerRadius, z, turnSign)` —
  the geometric expression of the rule: triangle when `innerRadius ≈ 0`
  (back-compat), else trapezoid `[innerA, outerA, outerB, innerB]`.

### Consumers wired

| Consumer | File | Change |
|---|---|---|
| Winder kind **+** L-shape-with-winders (σκάλα Γ) | `stair-geometry-winder.ts` | `assembleWinderRun` computes the rule once; `buildWinderTreads` builds trapezoids via `buildWinderWedge`. Both variants share `assembleWinderRun`, so both are fixed at once. |
| Code validator | `gate-stair-checker.ts` | new `checkWinderGeometry` folds winder going warnings into `codeViolations` (universal except `'none'`). |
| Walkline default | `stair-completion.ts` | `DEFAULT_WALKLINE_OFFSET_MM` fixed `600 → 300` (correct NOK offset now that the field is live). |

### Scope note

The **geometric walkline** (`buildWinderWalkline`, used for stringers/handrails)
is intentionally **left at width/2** — moving it would break stringer offsets.
The code walkline of this ADR is a **measurement** concept (rule + validator),
not the stored centreline.

## Consequences

- The visible "miter" is gone for the L-shape-with-winders stair (σκάλα Γ) and
  the winder kind: corner treads keep a code-compliant inner going.
- `codeProfile: 'none'` preserves the legacy triangle exactly (zero behaviour
  change for stairs that opt out).
- The rule is generic: future consumers (stair-from-region reflex arcs,
  gamma-with-winders) call the same `computeWinderWalklineRule` — no re-derivation.

## Testing

- `stair-winder-walkline-rule.test.ts` — 14 tests (mm/scene resolver, apex cut,
  walkline going, clamps/caps, wedge shape + winding).
- Regression: `StairGeometryService-winder` / `-lshape-winders` updated to the
  unified wedge behaviour. Full stairs dir: **202/202 green**. jscpd: clean.

## Changelog

- **2026-07-10** — Phase 1 (this ADR): SSoT module + geometry wiring (winder kind
  & L-shape-with-winders) + validator check + i18n (el/en) + `walklineOffset`
  default fix. Pending (Phase 2): stair-from-region reflex-arc consumer,
  gamma-with-winders corner style, browser verification of the trapezoid render.
