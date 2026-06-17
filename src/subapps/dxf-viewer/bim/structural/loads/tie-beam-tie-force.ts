/**
 * Σεισμική αξονική δύναμη σύνδεσης συνδετήριων δοκών — scene-level SSoT (ADR-477 Slice 3).
 *
 * EN1998-5 §5.4.1.2(7): οι συνδετήριες δοκοί (foundation tie-beams) σχεδιάζονται για
 * αξονική δύναμη `N_tie = ε·(a_gR/g)·S·N_Ed,mean`, όπου `N_Ed,mean` = μέσος όρος των
 * αξονικών των **συνδεόμενων υποστυλωμάτων** στα δύο άκρα της δοκού.
 *
 * **Συνδεσιμότητα = ΕΠΑΝΑΧΡΗΣΗ του organism SSoT (N.0.2 — μηδέν parallel heuristic):**
 * το άκρο της συνδετήριας εδράζεται σε **πέδιλο** → κάθε άκρο αντιστοιχίζεται στο
 * πέδιλο που το **περιέχει** (`resolveFootingSummary` footprint + `isPointInPolygon`
 * coverage SSoT, ίδιο κριτήριο με `footingSupportsColumnBase`/structural-graph), και
 * το στηρίζον υποστύλωμα προκύπτει από το FK `ColumnParams.footingId` (ίδιο pattern
 * με `computeFootingTakedownLoads`). Το αξονικό = χαρακτηριστικό SLS του `appliedLoad`
 * (μετά το load takedown). Καμία ad-hoc απόσταση/ανοχή — η ίδια αλήθεια με τον οργανισμό.
 *
 * Pure — zero store/Firestore/DOM (testable). geometry-is-SSoT. Η σεισμική αξονική
 * ΔΕΝ είναι βαρυτικό tributary → ΟΧΙ μέλος του load-path (μηδέν `isLoadPathMember`).
 *
 * @see ./seismic-params.ts — EC8 πίνακες (ε/S) + seismicTieForceFactor
 * @see ../../foundations/footing-element-summary.ts — resolveFootingSummary (footprint SSoT)
 * @see ../../foundations/footing-column-coverage.ts — isPointInPolygon coverage κριτήριο
 * @see ../footing-design/footing-load-takedown.ts — ίδιο footingId FK pattern
 * @see docs/centralized-systems/reference/adrs/ADR-477-tie-beam-reinforcement-unification.md §Slice 3
 */

import type { Entity } from '../../../types/entities';
import { isColumnEntity, isFoundationEntity } from '../../../types/entities';
import type { TieBeamParams } from '../../types/foundation-types';
import { resolveFootingSummary } from '../../foundations/footing-element-summary';
import type { CoveragePoint } from '../../foundations/footing-column-coverage';
import { isPointInPolygon } from '../../../utils/geometry/GeometryUtils';
import { combineSls } from './load-combinations';
import { resolveAppliedMemberLoad } from './structural-loads-types';
import { seismicTieForceFactor, type SeismicGroundType } from './seismic-params';

/** Πέδιλο-στήριγμα με το plan footprint του (canvas units· υποψήφιο στα άκρα). */
interface SupportFooting {
  readonly id: string;
  readonly footprint: readonly CoveragePoint[];
}

/** DERIVED patch δύναμης σύνδεσης ανά συνδετήρια δοκό. */
export interface TieBeamTieForcePatch {
  readonly tieBeamId: string;
  /** N_tie (kN) — στρογγυλεμένο στο 0.1 kN· 0 = χωρίς συνδεδεμένο φορτίο. */
  readonly seismicTieForceKn: number;
}

/**
 * Χαρακτηριστικό (SLS) αξονικό ανά `footingId` μέσω της στηρίζουσας κολώνας (FK —
 * ίδιο pattern με `computeFootingTakedownLoads`). Πολλές κολώνες στο ίδιο πέδιλο →
 * αθροιστικά (συντηρητικό).
 */
function columnAxialByFootingId(entities: readonly Entity[]): Map<string, number> {
  const byFooting = new Map<string, number>();
  for (const e of entities) {
    if (!isColumnEntity(e) || e.params.footingId === undefined) continue;
    const axialKn = combineSls(resolveAppliedMemberLoad(e.params.appliedLoad)).axialKn;
    byFooting.set(e.params.footingId, (byFooting.get(e.params.footingId) ?? 0) + axialKn);
  }
  return byFooting;
}

/** Πέδιλα-στηρίγματα (pad/strip, ΟΧΙ συνδετήριες) με έγκυρο footprint. */
function supportFootings(entities: readonly Entity[]): SupportFooting[] {
  const out: SupportFooting[] = [];
  for (const e of entities) {
    if (!isFoundationEntity(e) || e.params.kind === 'tie-beam') continue;
    const summary = resolveFootingSummary(e);
    if (summary && summary.footprint.length >= 3) out.push({ id: e.id, footprint: summary.footprint });
  }
  return out;
}

/**
 * Αξονικό του υποστυλώματος που εδράζεται στο πέδιλο **που περιέχει** το σημείο
 * (coverage SSoT + footingId FK), ή `null` αν δεν βρεθεί πέδιλο/στηρίζουσα κολώνα.
 */
function connectedColumnAxial(
  point: { readonly x: number; readonly y: number },
  footings: readonly SupportFooting[],
  axialByFooting: ReadonlyMap<string, number>,
): number | null {
  for (const f of footings) {
    if (isPointInPolygon(point, [...f.footprint])) {
      const axial = axialByFooting.get(f.id);
      if (axial !== undefined) return axial;
    }
  }
  return null;
}

/** Μέσος όρος αξονικών των συνδεόμενων υποστυλωμάτων στα δύο άκρα (N_Ed,mean, kN). */
function meanConnectedAxialKn(
  p: TieBeamParams,
  footings: readonly SupportFooting[],
  axialByFooting: ReadonlyMap<string, number>,
): number {
  const ends = [
    connectedColumnAxial(p.start, footings, axialByFooting),
    connectedColumnAxial(p.end, footings, axialByFooting),
  ];
  const present = ends.filter((v): v is number => v !== null && v > 0);
  if (present.length === 0) return 0;
  return present.reduce((sum, v) => sum + v, 0) / present.length;
}

/**
 * Υπολογίζει τη σεισμική δύναμη σύνδεσης κάθε συνδετήριας δοκού της σκηνής
 * (EN1998-5 §5.4.1.2(7)). Επιστρέφει ΕΝΑ patch ανά συνδετήρια (incl. 0 → καθαρισμός
 * παλαιάς τιμής). Κατηγορία εδάφους A ή μηδενική επιτάχυνση → κενό (factor 0).
 */
export function computeTieBeamTieForces(
  entities: readonly Entity[],
  groundType: SeismicGroundType,
  groundAccelRatio: number,
): TieBeamTieForcePatch[] {
  const factor = seismicTieForceFactor(groundType, groundAccelRatio);
  if (factor <= 0) return [];
  const axialByFooting = columnAxialByFootingId(entities);
  const footings = supportFootings(entities);
  const patches: TieBeamTieForcePatch[] = [];
  for (const e of entities) {
    if (!isFoundationEntity(e) || e.params.kind !== 'tie-beam') continue;
    const nTie = factor * meanConnectedAxialKn(e.params, footings, axialByFooting);
    patches.push({ tieBeamId: e.id, seismicTieForceKn: Math.round(nTie * 10) / 10 });
  }
  return patches;
}
