/**
 * ADR-441 Slice 6a — Canonical segment key από slot-based `guideBindings`.
 *
 * SSoT για το «ποιο φάτνωμα του κανάβου καλύπτει αυτός ο πεδιλοδοκός». Παράγει ένα
 * σταθερό, συγκρίσιμο κλειδί ανά grid-segment ΑΠΟΚΛΕΙΣΤΙΚΑ από τα bindings — ώστε το
 * ίδιο κλειδί να βγαίνει build-time (νέα strips, `foundation-from-grid.ts`) ΚΑΙ από
 * persisted/existing strips (scene). Έτσι η «Εσχάρα από κάναβο» γίνεται idempotent:
 * χτίζει μόνο τα ακάλυπτα segments (covered-set skip), τέρμα οι διπλοί.
 *
 * Orientation από τα bindings (βλ. `foundation-from-grid.ts` emit helpers):
 *  - Vertical X-strip:   start-x == end-x (παράλληλος άξονας X) + start-y/end-y endpoints.
 *  - Horizontal Y-strip: start-y == end-y (παράλληλος άξονας Y) + start-x/end-x endpoints.
 *
 * Το `extend` (corner-fill, ADR-441 Slice JOIN) ΑΓΝΟΕΙΤΑΙ — το κλειδί ταυτοποιεί το
 * φάτνωμα, όχι τη γεωμετρική προέκταση → robust σε γωνιακά segments.
 *
 * Σημειακά (pad/column, center-x/center-y) ή ελλιπή bindings → `null` (ποτέ cover).
 *
 * @see ./foundation-from-grid.ts — pure grid builder (καταναλωτής του coveredKeys)
 * @see ../hosting/guide-binding-types.ts — slot-based hosting model
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import type { GuideBinding, GuideBindingSlot } from '../hosting/guide-binding-types';
import type { FoundationEntity } from '../types/foundation-types';
import { mmScaleFor } from '../../utils/scene-units';

/** Slot → guideId map ενός segment (κρατά μόνο τα 4 linear slots). */
type SlotMap = Partial<Record<GuideBindingSlot, string>>;

/**
 * Tolerance (scene units) για το rounding των endpoint coordinates στο signature.
 *
 * ΠΡΕΠΕΙ να είναι **λεπτότερο** από το μικρότερο γεωμετρικά σημαντικό βήμα — και
 * αυτό είναι το corner-fill overhang `width/2`, που σε σκηνές **μέτρων** πέφτει σε
 * εκατοστά: π.χ. `250mm × mmToSceneUnits('m')=0.001 → 0.25` σκηνικές μονάδες. Με
 * χοντρό tol (=1) το overhang **χανόταν** στο rounding → η περιμετρική (με overhang)
 * και η εσωτερική (χωρίς) έπαιρναν ΙΔΙΟ signature → ο reconciler δεν αντικαθιστούσε
 * τη stale περιμετρική όταν έπαυε να είναι ακραία (Giorgio repro: «εισχωρεί w/2»).
 *
 * `0.001` σκηνικές μονάδες = sub-mm σε κάθε κλίμακα (mm/cm/m/in/ft) → διακρίνει το
 * overhang (≥~0.1 στη χειρότερη μικρή λωρίδα) ενώ απορροφά floating-point θόρυβο
 * (build vs re-derive vs persist παράγουν ταυτόσημα floats, διαφορές << 0.001).
 * Διακριτοί guides απέχουν >> 0.001 (guide-store dedup) → μηδέν false-merge.
 */
const SIGNATURE_COORD_TOL = 0.001;

/**
 * Ακέραιος bucket-δείκτης coordinate (σταθερό, καθαρό signature token). Ίδιο
 * coordinate (±tol) → ίδιος ακέραιος → ίδιο string· μηδέν floating-point θόρυβος
 * στο output (vs `bucket*tol` που θα έγραφε π.χ. `8.250000000000002`).
 */
function coordBucket(value: number): number {
  return Math.round(value / SIGNATURE_COORD_TOL);
}

/** Sorted-pair join (canonical endpoint pair, ανεξάρτητο σειράς). */
function pairKey(a: string, b: string): string {
  return a <= b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Canonical κλειδί grid-segment από τα bindings ενός strip, ή `null` αν δεν αντιστοιχεί
 * σε γραμμικό φάτνωμα κανάβου (σημειακό/ελλιπές). Total/pure.
 */
export function segmentKeyFromBindings(
  bindings: readonly GuideBinding[],
): string | null {
  const slots: SlotMap = {};
  for (const b of bindings) slots[b.slot] = b.guideId;

  const { 'start-x': sx, 'end-x': ex, 'start-y': sy, 'end-y': ey } = slots;

  // Vertical: ίδιος X-άξονας στα δύο άκρα + Y endpoints.
  if (sx !== undefined && ex !== undefined && sx === ex && sy !== undefined && ey !== undefined) {
    return `V|${sx}|${pairKey(sy, ey)}`;
  }
  // Horizontal: ίδιος Y-άξονας στα δύο άκρα + X endpoints.
  if (sy !== undefined && ey !== undefined && sy === ey && sx !== undefined && ex !== undefined) {
    return `H|${sy}|${pairKey(sx, ex)}`;
  }
  return null;
}

/**
 * Canonical κλειδί grid-**φατνώματος** (2D cell) από τα 4-axis bindings μιας πλάκας
 * (ADR-441 Slice GEN-SLAB), ή `null` αν δεν αντιστοιχεί σε φάτνωμα (γραμμικό/σημειακό/
 * ελλιπές). Σε αντίθεση με το `segmentKeyFromBindings` (ακμή: start-x==end-x), το
 * φάτνωμα έχει **διακριτούς** X-άξονες (αριστερά/δεξιά) ΚΑΙ Y-άξονες (κάτω/πάνω). Τα
 * pairKeys κάνουν το κλειδί ανεξάρτητο σειράς → robust idempotent skip (ίδιο φάτνωμα =
 * ίδιο κλειδί build-time & από persisted πλάκες). Total/pure.
 */
export function bayKeyFromBindings(
  bindings: readonly GuideBinding[],
): string | null {
  const slots: SlotMap = {};
  for (const b of bindings) slots[b.slot] = b.guideId;
  const { 'start-x': sx, 'end-x': ex, 'start-y': sy, 'end-y': ey } = slots;
  // Φάτνωμα: 4 διακριτοί άξονες (αριστερά≠δεξιά, κάτω≠πάνω).
  if (
    sx !== undefined && ex !== undefined && sx !== ex &&
    sy !== undefined && ey !== undefined && sy !== ey
  ) {
    return `BAY|${pairKey(sx, ex)}|${pairKey(sy, ey)}`;
  }
  return null;
}

/** Bare coordinate ενός endpoint = coord ΜΕΙΟΝ το junction `extend` του slot του. */
function bareCoord(
  value: number, slot: GuideBindingSlot, bindings: readonly GuideBinding[], scale: number,
): number {
  const ext = bindings.find((b) => b.slot === slot)?.extend ?? 0;
  return value - ext * scale;
}

/**
 * Canonical **signature** μιας grid-managed λωρίδας (ADR-441 Slice 6 reconcile):
 * grid-ταυτότητα (`segmentKey`) + rounded γεωμετρία στους **bare** κόμβους (= άξονες).
 *
 * **ADR-441 Slice 8:** τα coords κανονικοποιούνται αφαιρώντας το junction-miter
 * `extend` κάθε άκρου → το signature ταυτοποιεί το **grid-segment** (θέση κόμβων),
 * αμετάβλητο στο miter (όπως ήδη και στο justification). Έτσι το reconcile ταιριάζει
 * fresh target (μηδέν extend) με existing (με miter extends) → μηδέν spurious
 * delete/create· το miter εφαρμόζεται ως ξεχωριστό reflow (`computeGridJunctionExtends`).
 * Το `extend` ΔΕΝ είναι πια corner-fill identity (Slice 5a-grid → inward justification).
 *
 * `null` αν η λωρίδα δεν είναι grid-managed (μη γραμμική / χωρίς grid bindings) →
 * ο reconciler την αγνοεί (legacy ορφανές & χειροκίνητες μένουν ανέγγιχτες).
 */
export function gridStripSignature(
  strip: Pick<FoundationEntity, 'guideBindings' | 'params'>,
): string | null {
  const bindings = strip.guideBindings ?? [];
  const key = segmentKeyFromBindings(bindings);
  if (key === null) return null;
  const p = strip.params;
  if (!('start' in p) || !('end' in p)) return null;
  const scale = mmScaleFor(p);
  const sx = coordBucket(bareCoord(p.start.x, 'start-x', bindings, scale));
  const sy = coordBucket(bareCoord(p.start.y, 'start-y', bindings, scale));
  const ex = coordBucket(bareCoord(p.end.x, 'end-x', bindings, scale));
  const ey = coordBucket(bareCoord(p.end.y, 'end-y', bindings, scale));
  return `${key}|${sx},${sy}|${ex},${ey}`;
}
