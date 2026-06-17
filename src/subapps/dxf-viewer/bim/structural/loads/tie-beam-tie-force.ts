/**
 * Σεισμική αξονική δύναμη σύνδεσης συνδετήριων δοκών — scene-level SSoT (ADR-477 Slice 3).
 *
 * EN1998-5 §5.4.1.2(7): οι συνδετήριες δοκοί (foundation tie-beams) σχεδιάζονται για
 * αξονική δύναμη `N_tie = ε·(a_gR/g)·S·N_Ed,mean`, όπου `N_Ed,mean` = μέσος όρος των
 * αξονικών των **συνδεόμενων υποστυλωμάτων** στα δύο άκρα της δοκού. Αυτό το module
 * εντοπίζει τα υποστυλώματα στα άκρα (spatial proximity), αντλεί το αξονικό τους από
 * το `appliedLoad` (μετά το load takedown, ADR-464 S4) και υπολογίζει το `N_tie` ανά
 * συνδετήρια — DERIVED patch που γράφεται στα `TieBeamParams.seismicTieForceKn` και
 * τροφοδοτεί τον suggester (`As,tie = N_tie/f_yd`).
 *
 * Pure — zero store/Firestore/DOM (testable). geometry-is-SSoT. Η σεισμική αξονική
 * ΔΕΝ είναι βαρυτικό tributary → ΟΧΙ μέλος του load-path (μηδέν `isLoadPathMember`).
 *
 * @see ./seismic-params.ts — EC8 πίνακες (ε/S) + seismicTieForceFactor
 * @see ./structural-loads-types.ts — AppliedMemberLoad (πηγή N_Ed κολονών)
 * @see ../section-context.ts — buildFootingSectionContextFromParams (περνά designAxialTieKn)
 * @see docs/centralized-systems/reference/adrs/ADR-477-tie-beam-reinforcement-unification.md §Slice 3
 */

import type { Entity } from '../../../types/entities';
import { isColumnEntity, isFoundationEntity } from '../../../types/entities';
import type { TieBeamParams } from '../../types/foundation-types';
import { combineSls } from './load-combinations';
import { resolveAppliedMemberLoad } from './structural-loads-types';
import { seismicTieForceFactor, type SeismicGroundType } from './seismic-params';

/**
 * Ανοχή (mm) εντός της οποίας ένα υποστύλωμα θεωρείται «συνδεδεμένο» σε άκρο της
 * συνδετήριας. Οι δοκοί χαράσσονται μεταξύ κέντρων υποστυλωμάτων/πεδίλων (grid snap),
 * οπότε το άκρο πέφτει πρακτικά πάνω στο κέντρο — γενναιόδωρη ανοχή ~0.75 m.
 */
const TIE_END_CONNECT_TOL_MM = 750;

/** Θέση + χαρακτηριστικό αξονικό (SLS) ενός υποστυλώματος (mm / kN). */
interface ColumnAxial {
  readonly x: number;
  readonly y: number;
  readonly axialKn: number;
}

/** DERIVED patch δύναμης σύνδεσης ανά συνδετήρια δοκό. */
export interface TieBeamTieForcePatch {
  readonly tieBeamId: string;
  /** N_tie (kN) — στρογγυλεμένο στο 0.1 kN· 0 = χωρίς συνδεδεμένο φορτίο. */
  readonly seismicTieForceKn: number;
}

/** Χαρακτηριστικά (SLS) αξονικά όλων των υποστυλωμάτων της σκηνής. */
function columnAxials(entities: readonly Entity[]): ColumnAxial[] {
  const out: ColumnAxial[] = [];
  for (const e of entities) {
    if (!isColumnEntity(e)) continue;
    const axialKn = combineSls(resolveAppliedMemberLoad(e.params.appliedLoad)).axialKn;
    out.push({ x: e.params.position.x, y: e.params.position.y, axialKn });
  }
  return out;
}

/** Αξονικό του πλησιέστερου υποστυλώματος στο σημείο εντός ανοχής, ή `null`. */
function nearestColumnAxial(
  point: { readonly x: number; readonly y: number },
  columns: readonly ColumnAxial[],
): number | null {
  let best: number | null = null;
  let bestD2 = TIE_END_CONNECT_TOL_MM * TIE_END_CONNECT_TOL_MM;
  for (const c of columns) {
    const dx = c.x - point.x;
    const dy = c.y - point.y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= bestD2) {
      bestD2 = d2;
      best = c.axialKn;
    }
  }
  return best;
}

/** Μέσος όρος αξονικών των συνδεόμενων υποστυλωμάτων στα δύο άκρα (N_Ed,mean, kN). */
function meanConnectedAxialKn(p: TieBeamParams, columns: readonly ColumnAxial[]): number {
  const ends = [nearestColumnAxial(p.start, columns), nearestColumnAxial(p.end, columns)];
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
  const columns = columnAxials(entities);
  const patches: TieBeamTieForcePatch[] = [];
  for (const e of entities) {
    if (!isFoundationEntity(e) || e.params.kind !== 'tie-beam') continue;
    const nTie = factor * meanConnectedAxialKn(e.params, columns);
    patches.push({ tieBeamId: e.id, seismicTieForceKn: Math.round(nTie * 10) / 10 });
  }
  return patches;
}
