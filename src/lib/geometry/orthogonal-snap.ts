/**
 * =============================================================================
 * ΟΡΘΟΓΩΝΙΑ ΕΛΞΗ ΠΕΡΙΓΡΑΜΜΑΤΟΣ (SSoT) — «οι κατόψεις είναι ορθογώνιες»
 * =============================================================================
 *
 * Ένα περίγραμμα που βγαίνει από pixel (Moore → Douglas–Peucker) έχει ακμές 88°–92° και σκαλοπάτια. Εδώ:
 * 1. **Κυρίαρχος άξονας** της κάτοψης (μπορεί να είναι στραμμένη): κυκλικός μέσος όρος της γωνίας κάθε ακμής
 *    **modulo 90°**, με βάρος το μήκος (ο «τετραπλός» μέσος όρος: `atan2(Σ ℓ·sin 4α, Σ ℓ·cos 4α) / 4`).
 * 2. Κάθε ακμή κοντά σε άξονα (± ανοχή) **γυρίζει** πάνω στον άξονα γύρω από το μέσο της· οι άλλες μένουν (λοξός
 *    τοίχος ή κυρτή ακμή δεν «ισιώνονται» ψεύτικα).
 * 3. Διαδοχικές ακμές που έγιναν **παράλληλες** ενώνονται σε μία (μέση θέση με βάρος το μήκος).
 * 4. Προαιρετική **μετατόπιση προς τα έξω** κάθε ευθείας (π.χ. μισό pixel: το ίχνος Moore περνά από κέντρα pixel,
 *    ενώ η παρειά του τοίχου είναι στην ακμή τους).
 * 5. Νέες κορυφές = τομές διαδοχικών ευθειών.
 *
 * 🔒 **Δίχτυ ασφαλείας**: αν το αποτέλεσμα αυτοτέμνεται ή το εμβαδόν του φύγει > 15% από το αρχικό, επιστρέφεται
 * `null` και ο καλών κρατά το απλοποιημένο περίγραμμα — ποτέ «ωραιότερο αλλά λάθος» σχήμα.
 *
 * Επίπεδο, χωρίς μονάδες.
 *
 * @module lib/geometry/orthogonal-snap
 */

import { intersectLines, isPolygonSelfIntersecting, polygonArea, shoelaceArea, type PlanarPoint } from './planar-polygon';

/**
 * Ρηχό **εξόγκωμα προς τα έξω** που ισοπεδώνεται στην ευθεία της βάσης του: το «μισό πάχος τοίχου» μέσα σε ένα
 * άνοιγμα πόρτας (η ανίχνευση χωρίζει δύο χώρους στη μέση του ανοίγματος — το δωμάτιο όμως τελειώνει στην παρειά,
 * όπως στο Revit/Zillow). Εσοχές **προς τα μέσα** (παραστάδα, κολόνα) **δεν** αγγίζονται — είναι αληθινό σχήμα.
 */
export interface ProtrusionFlattening {
  readonly maxDepth: number;
  readonly maxWidth: number;
}

export interface OrthogonalSnapOptions {
  /** Μέγιστη απόκλιση ακμής από άξονα για να «γυρίσει» (rad). */
  readonly toleranceRad: number;
  /** Μετατόπιση κάθε ευθείας προς τα έξω, στις μονάδες του δακτυλίου (0 = καμία). */
  readonly outset: number;
  /** Ισοπέδωση ρηχών εξογκωμάτων — `null` = καμία. */
  readonly flatten: ProtrusionFlattening | null;
}

export const DEFAULT_ORTHOGONAL_SNAP: OrthogonalSnapOptions = {
  toleranceRad: (12 * Math.PI) / 180, outset: 0, flatten: null,
};

/** Μέγιστη σχετική μεταβολή εμβαδού πριν απορριφθεί η έλξη. */
const MAX_AREA_DRIFT = 0.15;

/** Ευθεία φορέας ακμής: σημείο + μοναδιαία διεύθυνση + μήκος της ακμής που τη γέννησε. */
interface CarrierLine {
  px: number;
  py: number;
  readonly dx: number;
  readonly dy: number;
  len: number;
}

/** Κυρίαρχος άξονας (rad, στο `[0, π/2)`) ενός δακτυλίου — κυκλικός μέσος όρος modulo 90° με βάρος το μήκος. */
export function dominantAxis(ring: readonly PlanarPoint[]): number {
  let s = 0, c = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    s += len * Math.sin(4 * angle);
    c += len * Math.cos(4 * angle);
  }
  const axis = Math.atan2(s, c) / 4;
  return axis < 0 ? axis + Math.PI / 2 : axis;
}

/** Ο πλησιέστερος άξονας (`axis + k·90°`) στη γωνία μιας ακμής. */
function nearestAxisAngle(angle: number, axis: number): number {
  const quarter = Math.PI / 2;
  return axis + Math.round((angle - axis) / quarter) * quarter;
}

/**
 * Πόσο απέχει (rad, ≥ 0) η γωνία μιας ακμής από τον πλησιέστερο άξονα της κάτοψης. Ο **ένας** ορισμός του «ακμή σε άξονα»:
 * τον ρωτούν η ορθογώνια έλξη (εδώ) και η απορρόφηση του συμβόλου πόρτας — δεύτερος ορισμός θα διαφωνούσε στο όριο.
 */
export function axisDeviation(angle: number, axis: number): number {
  return Math.abs(angle - nearestAxisAngle(angle, axis));
}

/** Διεύθυνση της ακμής, στραμμένη στον πλησιέστερο άξονα αν απέχει ≤ ανοχή. */
function carrierDirection(angle: number, axis: number, toleranceRad: number): { dx: number; dy: number } {
  const use = axisDeviation(angle, axis) <= toleranceRad ? nearestAxisAngle(angle, axis) : angle;
  return { dx: Math.cos(use), dy: Math.sin(use) };
}

/** Ευθείες φορείς όλων των ακμών (εκφυλισμένες ακμές παραλείπονται). */
function carrierLines(ring: readonly PlanarPoint[], axis: number, toleranceRad: number): CarrierLine[] {
  const lines: CarrierLine[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    const { dx, dy } = carrierDirection(Math.atan2(b.y - a.y, b.x - a.x), axis, toleranceRad);
    lines.push({ px: (a.x + b.x) / 2, py: (a.y + b.y) / 2, dx, dy, len });
  }
  return lines;
}

const parallel = (a: CarrierLine, b: CarrierLine): boolean => Math.abs(a.dx * b.dy - a.dy * b.dx) < 1e-9;
const sameWay = (a: CarrierLine, b: CarrierLine): boolean => parallel(a, b) && a.dx * b.dx + a.dy * b.dy > 0;

/** Ενώνει τη `b` στην `a` (ίδια διεύθυνση): μέση θέση κατά τον κάθετο άξονα με βάρος το μήκος. */
function mergeInto(a: CarrierLine, b: CarrierLine): void {
  const total = a.len + b.len;
  a.px = (a.px * a.len + b.px * b.len) / total;
  a.py = (a.py * a.len + b.py * b.len) / total;
  a.len = total;
}

/** Ενώνει κυκλικά κάθε ζεύγος διαδοχικών παράλληλων ευθειών ώσπου να μη μείνει κανένα. */
function mergeParallel(lines: CarrierLine[]): CarrierLine[] {
  const out = [...lines];
  let changed = true;
  while (changed && out.length > 2) {
    changed = false;
    for (let i = 0; i < out.length && out.length > 2; i++) {
      const j = (i + 1) % out.length;
      if (parallel(out[i], out[j])) {
        mergeInto(out[i], out[j]);
        out.splice(j, 1);
        changed = true;
      }
    }
  }
  return out;
}

/** Απόσταση του σημείου της `p` από την ευθεία `base`, θετική **προς τα έξω**. */
function outwardOffset(base: CarrierLine, p: CarrierLine, positiveOrientation: boolean): number {
  const sign = positiveOrientation ? 1 : -1;
  return sign * ((p.px - base.px) * base.dy - (p.py - base.py) * base.dx);
}

/** Είναι οι ευθείες `i … i+4` ένα ρηχό εξόγκωμα προς τα έξω πάνω στη βάση `i` (με συνέχεια τη `i+4`); */
function isShallowProtrusion(
  lines: readonly CarrierLine[], i: number, limits: ProtrusionFlattening, positiveOrientation: boolean,
): boolean {
  const at = (k: number): CarrierLine => lines[(i + k) % lines.length];
  const [base, side1, top, side2, rest] = [at(0), at(1), at(2), at(3), at(4)];
  if (!sameWay(base, top) || !sameWay(base, rest) || !parallel(side1, side2)) return false;
  const depth = outwardOffset(base, top, positiveOrientation);
  const width = Math.abs((side2.px - side1.px) * base.dx + (side2.py - side1.py) * base.dy);
  const resumes = Math.abs(outwardOffset(base, rest, positiveOrientation)) <= depth / 2;
  return depth > 0 && depth <= limits.maxDepth && width <= limits.maxWidth && resumes;
}

/** Ισοπεδώνει κάθε ρηχό εξόγκωμα: σβήνει τις τρεις ευθείες του και ενώνει τη βάση με τη συνέχειά της. */
function flattenProtrusions(
  lines: CarrierLine[], limits: ProtrusionFlattening, positiveOrientation: boolean,
): CarrierLine[] {
  const out = [...lines];
  let changed = true;
  while (changed && out.length >= 7) {
    changed = false;
    for (let i = 0; i < out.length && out.length >= 7; i++) {
      if (!isShallowProtrusion(out, i, limits, positiveOrientation)) continue;
      const doomed = [1, 2, 3, 4].map((k) => (i + k) % out.length);
      mergeInto(out[i], out[doomed[3]]);
      for (const k of [...doomed].sort((p, q) => q - p)) out.splice(k, 1);
      changed = true;
    }
  }
  return out;
}

/** Τομή δύο ευθειών φορέων — `null` όταν είναι (σχεδόν) παράλληλες. */
function intersect(a: CarrierLine, b: CarrierLine): PlanarPoint | null {
  return intersectLines({ x: a.px, y: a.py }, { x: a.dx, y: a.dy }, { x: b.px, y: b.py }, { x: b.dx, y: b.dy });
}

/** Μετατοπίζει κάθε ευθεία κατά `outset` προς τα έξω (έξω = δεξιά της φοράς σε θετικό/CCW δακτύλιο). */
function applyOutset(lines: CarrierLine[], outset: number, positiveOrientation: boolean): void {
  if (outset === 0) return;
  const sign = positiveOrientation ? 1 : -1;
  for (const line of lines) {
    line.px += sign * line.dy * outset;
    line.py -= sign * line.dx * outset;
  }
}

/**
 * Ορθογώνια έλξη κλειστού δακτυλίου (χωρίς επαναλαμβανόμενη τελευταία κορυφή). `null` όταν το αποτέλεσμα δεν
 * περνά το δίχτυ ασφαλείας (αυτοτομή · εμβαδόν εκτός ±15% · < 3 κορυφές).
 */
export function snapRingOrthogonal(
  ring: readonly PlanarPoint[], options: OrthogonalSnapOptions = DEFAULT_ORTHOGONAL_SNAP,
): PlanarPoint[] | null {
  if (ring.length < 3) return null;
  const positive = shoelaceArea(ring) > 0;
  const merged = mergeParallel(carrierLines(ring, dominantAxis(ring), options.toleranceRad));
  const lines = options.flatten ? flattenProtrusions(merged, options.flatten, positive) : merged;
  if (lines.length < 3) return null;
  // Το δίχτυ κρίνει το σχήμα ΠΡΙΝ τη μετατόπιση: η μετατόπιση μεγαλώνει σκόπιμα το εμβαδόν.
  const snapped = cornersOf(lines);
  if (!snapped || isPolygonSelfIntersecting(snapped)) return null;
  const before = polygonArea(ring);
  if (Math.abs(polygonArea(snapped) - before) / (before || 1) > MAX_AREA_DRIFT) return null;
  if (options.outset === 0) return snapped;
  applyOutset(lines, options.outset, positive);
  const grown = cornersOf(lines);
  return grown && !isPolygonSelfIntersecting(grown) ? grown : null;
}

/** Κορυφές = τομές διαδοχικών ευθειών φορέων· `null` αν δύο διαδοχικές είναι παράλληλες. */
function cornersOf(lines: readonly CarrierLine[]): PlanarPoint[] | null {
  const out: PlanarPoint[] = [];
  for (let i = 0; i < lines.length; i++) {
    const corner = intersect(lines[(i + lines.length - 1) % lines.length], lines[i]);
    if (!corner) return null;
    out.push(corner);
  }
  return out;
}
