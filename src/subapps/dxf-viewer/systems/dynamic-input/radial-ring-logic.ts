/**
 * ADR-513 — Pure logic του «Δαχτυλιδιού Εντολών» (Radial Command Ring), εκτός React:
 * TAB-order, lock-highlight, live μήκος/γωνία (ίδιος υπολογισμός με wall-hud) και οι
 * μετατροπές μονάδων στο commit (display → scene/mm). Εδώ ζει η μη-UI λογική ώστε να
 * είναι fully unit-testable και το component να μένει thin.
 *
 * Zero React / DOM dependencies.
 */

import type { Point2D } from '../../rendering/types/Types';
import { type DisplayUnit, fromDisplay } from '../../config/units';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';

/** Κλειδιά πεδίων + TAB-order: Μήκος → Γωνία → Πάχος → Ύψος. */
export type RingFieldKey = 'length' | 'angle' | 'thickness' | 'height';
export const RING_TAB_ORDER: readonly RingFieldKey[] = ['length', 'angle', 'thickness', 'height'];

// ── NavWheel geometry & deadzone «δάχτυλο-σε-δαχτυλίδι» (ADR-513) ─────────────
// Δύο ομόκεντροι κύκλοι: ΕΣΩΤΕΡΙΚΟΣ ορατός (4 πλήρεις pie-wedges, ΧΩΡΙΣ τρύπα/hub, με labels)
// + ΕΞΩΤΕΡΙΚΟΣ αόρατος (deadzone). Ο κέρσορας κινείται ελεύθερα μέσα· το δαχτυλίδι ΔΕΝ ακολουθεί.
// Σπρώχνεται ΜΟΝΟ όταν ο κέρσορας φτάσει στην περιφέρεια του εξωτερικού (όπως δάχτυλο σε δαχτυλίδι).

/** Ακτίνα εσωτερικού ορατού κύκλου (px) — τα πλήκτρα/wedges. Μικρό (Giorgio: «μίκρυνε κι άλλο»). */
export const RING_INNER_R = 52;
/** Ακτίνα εξωτερικού ΑΟΡΑΤΟΥ κύκλου (px) — deadzone· εκεί σπρώχνεται το δαχτυλίδι. */
export const RING_OUTER_R = 96;
/** Ημιδιαφάνεια wedges (Giorgio: «ακόμη πιο διαφανή»). Hover → πιο αδιαφανές. */
export const RING_OPACITY = 0.28;
export const RING_HOVER_OPACITY = 0.55;

// ── Tool-agnostic DYNAMIC wedge geometry (ADR-513 §equal-slices) ──────────────
// Ο κύκλος χωρίζεται σε **N ΙΣΕΣ φέτες** ανάλογα με το ΠΛΗΘΟΣ των εντολών του εργαλείου
// (Giorgio: «2 εντολές → 2 ημικύκλια· 3 → 3 ίσες φέτες»). Η φέτα κάθε πεδίου προκύπτει από
// τη ΘΕΣΗ του στο `RingConfig.fields` (index), ΟΧΙ από σταθερή cardinal θέση — έτσι ΕΝΑ
// component εξυπηρετεί οποιοδήποτε πλήθος εντολών, κεντρικοποιημένα.

/** Γωνία της ΠΑΝΩ (Βορράς) κατεύθυνσης (μοίρες, y-κάτω οθόνη). Η φέτα 0 κεντράρεται εδώ. */
export const RING_TOP_DEG = 270;

/** Μία ίση φέτα του δαχτυλιδιού: index + κεντρική γωνία + γωνιακό εύρος [a0, a1] (μοίρες, y-κάτω). */
export interface RingSlice {
  readonly index: number;
  readonly centerDeg: number;
  readonly a0: number;
  readonly a1: number;
}

/**
 * Χώρισε τον πλήρη κύκλο σε `count` ΙΣΕΣ φέτες (360/count η καθεμία). Η φέτα 0 κεντράρεται στην
 * ΠΑΝΩ κατεύθυνση (`RING_TOP_DEG`) και οι επόμενες πάνε δεξιόστροφα (y-κάτω). Παραδείγματα:
 * count=2 → δύο ημικύκλια (πάνω/κάτω)· count=3 → 3×120°· count=4 → οι cardinal top/right/bottom/left.
 * ΕΝΑΣ SSoT για τη γεωμετρία των φετών (κάθε εργαλείο, κάθε πλήθος). Καθαρή συνάρτηση → testable.
 */
export function computeRingSlices(count: number, firstCenterDeg = RING_TOP_DEG): readonly RingSlice[] {
  if (count <= 0) return [];
  const span = 360 / count;
  return Array.from({ length: count }, (_, index) => {
    const centerDeg = normalizeAngleDeg(firstCenterDeg + index * span);
    return { index, centerDeg, a0: centerDeg - span / 2, a1: centerDeg + span / 2 };
  });
}

/**
 * Σε ποια ίση φέτα (index 0..count-1) πέφτει μια γωνία `deg` (μοίρες, y-κάτω) — αντίστροφο του
 * `computeRingSlices`. Επιστρέφει −1 όταν `count<=0`. ΙΔΙΟ `firstCenterDeg`/`count` με το render.
 */
export function sliceIndexAtAngle(deg: number, count: number, firstCenterDeg = RING_TOP_DEG): number {
  if (count <= 0) return -1;
  const span = 360 / count;
  const rel = normalizeAngleDeg(deg - (firstCenterDeg - span / 2));
  return Math.min(count - 1, Math.floor(rel / span));
}

/** Σημείο σε πολικές → καρτεσιανές (y-κάτω, οθόνη). */
export function polarPoint(cx: number, cy: number, r: number, deg: number): Point2D {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/**
 * SVG path πλήρους pie-τομέα (από ΚΕΝΤΡΟ → περιφέρεια, ΧΩΡΙΣ hub) μεταξύ `a0..a1`.
 * Για 90° wedges το large-arc-flag = 0. Καθαρή συνάρτηση (deterministic) → testable.
 */
export function pieSectorPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const large = (((a1 - a0) % 360) + 360) % 360 > 180 ? 1 : 0;
  const p0 = polarPoint(cx, cy, r, a0);
  const p1 = polarPoint(cx, cy, r, a1);
  return `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y} Z`;
}

export type CursorZone = 'inside' | 'annulus' | 'outside';
/** Ζώνη του κέρσορα σε σχέση με τους δύο κύκλους (απόσταση από κέντρο δαχτυλιδιού). */
export function cursorZone(dist: number, rInner = RING_INNER_R, rOuter = RING_OUTER_R): CursorZone {
  if (dist <= rInner) return 'inside';
  if (dist <= rOuter) return 'annulus';
  return 'outside';
}

/**
 * «Δάχτυλο-σε-δαχτυλίδι» push: αν ο κέρσορας ξεπερνά την περιφέρεια του εξωτερικού κύκλου,
 * σύρε το κέντρο ώστε ο κέρσορας να μένει ΑΚΡΙΒΩΣ στο `rOuter` όριο· αλλιώς άφησέ το ακίνητο.
 */
export function pushWheelCenter(center: Readonly<Point2D>, cursor: Readonly<Point2D>, rOuter = RING_OUTER_R): Point2D {
  const dx = cursor.x - center.x;
  const dy = cursor.y - center.y;
  const d = Math.hypot(dx, dy);
  if (d <= rOuter || d < 1e-6) return { x: center.x, y: center.y };
  const k = rOuter / d;
  return { x: cursor.x - dx * k, y: cursor.y - dy * k };
}

/**
 * Παράγοντας follow όταν ο κέρσορας κινείται ΜΕΣΑ στα πλήκτρα (Giorgio: «ταχύτητα 1 → δαχτυλίδι 1/2»).
 * Το δαχτυλίδι «βαραίνει» — ακολουθεί στο μισό της ταχύτητας του κέρσορα στη ζώνη `inside`.
 */
export const RING_INSIDE_FOLLOW_RATIO = 0.5;

/**
 * Νέο κέντρο δαχτυλιδιού ανά κίνηση κέρσορα, βάσει ζώνης:
 *   · `inside`  → half-speed drag (`ratio` του cursor-delta· Giorgio),
 *   · `annulus` → ακίνητο (deadzone),
 *   · `outside` → push στην περιφέρεια του εξωτερικού κύκλου (`pushWheelCenter`).
 */
export function advanceWheelCenter(
  center: Readonly<Point2D>,
  prevCursor: Readonly<Point2D>,
  cursor: Readonly<Point2D>,
  zone: CursorZone,
  ratio = RING_INSIDE_FOLLOW_RATIO,
  rOuter = RING_OUTER_R,
): Point2D {
  if (zone === 'inside') {
    return { x: center.x + ratio * (cursor.x - prevCursor.x), y: center.y + ratio * (cursor.y - prevCursor.y) };
  }
  if (zone === 'annulus') return { x: center.x, y: center.y };
  return pushWheelCenter(center, cursor, rOuter);
}

/**
 * Επόμενο/προηγούμενο κλειδί σε **οποιαδήποτε** σειρά πεδίων (Shift = ανάποδα), wrap-around.
 * SSoT του «lock-and-advance» (ADR-513 §multi-field-lock): οδηγείται από τη ΣΕΙΡΑ ΤΟΥ `RingConfig`
 * (`config.fields.map(f => f.key)`), ώστε να καλύπτει ΚΑΙ πεδία εκτός του σταθερού `RING_TAB_ORDER`
 * (π.χ. `linetype` της γραμμής, `type` της δοκού). Επιστρέφει `null` όταν το `current` δεν είναι στη
 * λίστα ή η λίστα είναι κενή (ο caller μένει στο τρέχον πεδίο). Καθαρή συνάρτηση → testable.
 */
export function nextFieldKeyInOrder(order: readonly string[], current: string, shift = false): string | null {
  const i = order.indexOf(current);
  if (i < 0 || order.length === 0) return null;
  const len = order.length;
  return order[(i + (shift ? len - 1 : 1)) % len];
}

/** Επόμενο/προηγούμενο πεδίο στον σταθερό κύκλο TAB (Shift+TAB = ανάποδα), wrap-around.
 * Delegates στο γενικό `nextFieldKeyInOrder` με το `RING_TAB_ORDER` (μηδέν διπλότυπο cycle-logic). */
export function nextRingField(current: RingFieldKey, shift: boolean): RingFieldKey {
  return (nextFieldKeyInOrder(RING_TAB_ORDER, current, shift) ?? current) as RingFieldKey;
}

/**
 * True όταν το Μήκος/Γωνία πεδίο είναι κλειδωμένο (dual lock — ανεξάρτητα, ADR-513).
 * Πάχος/Ύψος κλειδώνουν ως overrides (ξεχωριστός έλεγχος στο component).
 */
export function isRingFieldLocked(key: RingFieldKey, lock: { length: number | null; angle: number | null }): boolean {
  return (key === 'length' && lock.length !== null) || (key === 'angle' && lock.angle !== null);
}

/**
 * Live μήκος (mm) + γωνία (μοίρες, 0..360) από αρχή→cursor — ίδιος υπολογισμός με το
 * `buildWallHudMeta` / `useDynamicInputRealtime` (scene distance → mm μέσω `mmToSceneUnits`).
 */
export function computeLiveLengthAngle(
  start: Readonly<Point2D>,
  cursor: Readonly<Point2D>,
  sceneUnits: SceneUnits,
): { lengthMm: number; angleDeg: number } {
  const dx = cursor.x - start.x;
  const dy = cursor.y - start.y;
  const lengthMm = Math.hypot(dx, dy) / mmToSceneUnits(sceneUnits);
  const raw = (Math.atan2(dy, dx) * 180) / Math.PI;
  return { lengthMm, angleDeg: raw < 0 ? raw + 360 : raw };
}

/** Μήκος display → scene-units (η μονάδα που περιμένει το `DynamicInputLockStore.lockLength`). */
export function lengthDisplayToSceneLock(displayValue: number, unit: DisplayUnit, sceneUnits: SceneUnits): number {
  return fromDisplay(displayValue, unit) * mmToSceneUnits(sceneUnits);
}

/** Κανονικοποίηση γωνίας στο [0, 360). */
export function normalizeAngleDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}
