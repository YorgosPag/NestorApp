/**
 * ADR-720 — the SSoT for **one** question: «does this survey point carry a measured elevation,
 * and what follows from the answer?»
 *
 * ── Why this file exists ────────────────────────────────────────────────────────────────────
 * Until ADR-720 the importer answered the question by DELETING the point: `mapRowToPoint`
 * returned `null` for any row without a Ζ, so a CSV row with a position but no elevation never
 * reached the store. In a real survey those rows are not noise — they are the **parcel corners**.
 * (Measured 2026-07-28 on the survey that forced this change: 7 of the 9 boundary vertices were
 * CSV points, matching to 2–6 mm, and **not one** of them had an elevation. The importer threw
 * away exactly the points the user needed and kept the neighbours'.)
 *
 * So `TopoPoint.z` became optional, and with it came a duty: every consumer must now say what it
 * does when the elevation is missing. This module is where that is said ONCE, so the answer
 * cannot drift between the eight places that ask.
 *
 * ── The three answers, and who gives them ───────────────────────────────────────────────────
 *   {@link hasElevation}          one point  → narrows to `TopoPoint3D` (a type guard, so the
 *                                              compiler carries the proof forward)
 *   {@link surfacePointsOf}       many points→ the subset a SURFACE may consume. The one filter.
 *   {@link describeElevationCoverage}         → the counts the UI reports, so «60 rows will be
 *                                              skipped» can become «60 imported as planimetric».
 *
 * ── ADR-731 added a SECOND question, and it is not the same one ─────────────────────────────
 * «Is there an elevation?» (`hasElevation`) and «**who put it there?**» (`isMeasuredElevation`)
 * are different questions, and a consumer that asks the first when it means the second is the
 * whole ADR-731 bug: a point that took its Ζ **from** the TIN becomes, on the next build, a
 * **vertex of that same TIN**. The surface then feeds on itself — three times as many vertices,
 * not one new measurement — and the ADR-725 coverage check counts the guesses as measurements
 * and goes quiet forever.
 *
 *   {@link isMeasuredElevation}   «was it measured **in the field**?» → the surface's question
 *   {@link isDerivedElevation}    «was it interpolated from the surface?» → the label's question
 *
 * 📌 **Which one do I want?** If your answer FEEDS the surface (triangulation, breakline borrow,
 * coverage QA) you want {@link isMeasuredElevation}. If you only DISPLAY or EXPORT the number
 * (label, coordinate table, tooltip) you want {@link hasElevation} — and you must then say, in
 * the output, that it is derived. A derived elevation that looks identical to a measured one on
 * a **signed** coordinate table is a professional-liability problem, not a cosmetic one.
 *
 * ⚠️ **Do not add a fourth road.** The tempting `p.z ?? 0` is the whole bug in one operator: a
 * fabricated 0 is indistinguishable from a measured sea-level shot, it triangulates into a crater,
 * and the crater is priced as excavation. If a consumer genuinely cannot proceed without an
 * elevation, it must EXCLUDE the point (that is what «Non-Surface» means in Carlson and what
 * `*PROPERTY NOT SET*` means in Civil 3D) — never substitute one.
 *
 * Pure: no store reads, no side effects. Every function is total and order-preserving.
 *
 * @see ./topo-types — `TopoPoint` (`z?`) and `TopoPoint3D` (`z`), with the standards citations
 * @see ./tin-builder — the surface's only entry point, and therefore the only caller that FILTERS
 * @see docs/centralized-systems/reference/adrs/ADR-720-survey-points-without-elevation.md
 */

import type { TopoPoint, TopoPoint3D } from './topo-types';

/**
 * Was this point's elevation measured?
 *
 * A **type guard**, deliberately: it does not merely answer, it hands the caller a
 * {@link TopoPoint3D} so the narrowing survives into the branch and `p.z` becomes a plain
 * `number`. That is what stops the next `?? 0` from being written — there is nothing left to
 * defend against once the compiler knows.
 *
 * `Number.isFinite` rather than `!== undefined` on purpose: a `NaN` that slipped past a parser is
 * not an elevation either, and a NaN vertex poisons the CDT into producing garbage triangles far
 * more quietly than a missing one ever could (ADR-537: one bad number blanks the whole 3D view).
 */
export function hasElevation(point: TopoPoint): point is TopoPoint3D {
  return Number.isFinite(point.z);
}

/**
 * ADR-731 — was this elevation **interpolated from the surface** rather than measured?
 *
 * Deliberately NOT the negation of {@link isMeasuredElevation}: a **planimetric** point (no Ζ at
 * all) is neither measured nor derived, and collapsing those two into one boolean is how a UI
 * ends up printing «derived» next to a blank. Three states, three answers.
 */
export function isDerivedElevation(point: TopoPoint): boolean {
  return point.zSource === 'derived' && hasElevation(point);
}

/**
 * ADR-731 — was this elevation **measured in the field**?
 *
 * THE question for anything that feeds the surface. Same type guard as {@link hasElevation} (the
 * caller still gets a `TopoPoint3D`), but strictly narrower: it also refuses an elevation this
 * application itself interpolated, because triangulating one would be **circular** — the vertex
 * would define the surface it was read from.
 *
 * Absence of `zSource` means measured, so every point that existed before ADR-731 answers `true`
 * unchanged. There is no migration, and no window in which old data reads as derived.
 */
export function isMeasuredElevation(point: TopoPoint): point is TopoPoint3D {
  return hasElevation(point) && point.zSource !== 'derived';
}

/**
 * The subset of a survey that may **define a surface** — Carlson's «surface points», the ones
 * Civil 3D lets contribute a TIN vertex.
 *
 * This is THE filter. It is called at the top of `buildTin`, which is the single door into the
 * triangulation, so every downstream product — contours, 3D terrain, cut/fill volumes, the plan
 * footprint, the cut cap, the deliverable tables — inherits the exclusion without one line
 * changing in any of them. Scattering `if (p.z !== undefined)` across those eight consumers is
 * how one of them ends up disagreeing with the other seven about what the ground is.
 *
 * Returns the SAME array reference when every point is elevated (the overwhelmingly common case),
 * so the memo in `topo-surface` — which compares definitions by identity — is not defeated by a
 * filter that allocates a fresh equal array on every read.
 *
 * 🔴 **ADR-731 — it filters on {@link isMeasuredElevation}, not {@link hasElevation}.** A point
 * whose Ζ this application interpolated FROM this surface must not become a VERTEX OF it. That is
 * not a preference, it is a cycle: the vertex would be defining the surface it was read from, the
 * TIN would gain vertices carrying zero new information, and the ADR-725 coverage check —
 * which asks «how much of the parcel rests on measurement?» — would count the guesses as
 * measurements and fall permanently silent. Being the single door into the triangulation, this
 * one line is what makes the cycle **structurally impossible** rather than merely discouraged.
 *
 * This is Carlson's «Non-Surface» tag, except that Carlson makes the surveyor remember to tick a
 * checkbox per point, and Civil 3D does not stop you from adding the interpolated COGO points to
 * the surface at all.
 */
export function surfacePointsOf(points: readonly TopoPoint[]): readonly TopoPoint3D[] {
  const measured = points.filter(isMeasuredElevation);
  return measured.length === points.length ? (points as readonly TopoPoint3D[]) : measured;
}

/** How a set of survey points splits between measured elevations and positions only. */
export interface ElevationCoverage {
  /** Every point that was read — the number that used to be «points» before ADR-720. */
  readonly total: number;
  /**
   * Points that carry a Ζ **of any provenance** — measured plus derived.
   *
   * ⚠️ ADR-731: this is NO LONGER the same as «points that define the surface». That is
   * `withElevation − derived`. The name is kept because the import wizard's sentence is about
   * what came out of the file, and at import time nothing is derived yet.
   */
  readonly withElevation: number;
  /** Points recorded as position only. Imported, visible, snappable — outside the surface. */
  readonly planimetricOnly: number;
  /**
   * ADR-731 — of {@link withElevation}, how many were **interpolated from the surface** rather
   * than measured. **These do NOT define the surface** (see {@link surfacePointsOf}).
   *
   * Always `0` on a freshly imported survey: derivation is a deliberate, separate user command
   * (ADR-720 §5 — never automatic). It becomes non-zero only after «Απόδοση υψομέτρου», and that
   * is exactly when the UI must stop saying «93 with elevation» and start saying «33 measured,
   * 60 derived» — otherwise the command silently launders guesses into measurements.
   */
  readonly derived: number;
}

/**
 * Count the split, for the ONE place that must say it out loud: the import wizard.
 *
 * The counts are what turn a silent loss into a stated fact. Before ADR-720 the wizard said
 * «33 points · 60 rows will be skipped» — accurate about the mechanism, and completely wrong
 * about the consequence, since the 60 were the parcel. Afterwards it says «93 points (33 with
 * elevation / 60 planimetric)», and nothing is skipped at all.
 *
 * This is also where we go past the big players rather than merely matching them. Civil 3D warns
 * only **afterwards**, when a surface rebuild finds nothing to triangulate; Carlson needs the
 * shots to be tagged «Non-Surface» **by hand**. We hold the distinction in the data itself — Ζ is
 * there or it is not — so it can be counted, shown **before** the engineer commits, and cost
 * nothing to maintain.
 */
export function describeElevationCoverage(points: readonly TopoPoint[]): ElevationCoverage {
  let withElevation = 0;
  let derived = 0;
  for (const point of points) {
    if (!hasElevation(point)) continue;
    withElevation++;
    if (isDerivedElevation(point)) derived++;
  }
  return {
    total: points.length,
    withElevation,
    planimetricOnly: points.length - withElevation,
    derived,
  };
}
