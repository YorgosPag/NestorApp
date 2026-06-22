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

/** Γωνιακό εύρος κάθε wedge (μοίρες, y-κάτω, 0°=Ανατολή): Μήκος πάνω, Γωνία δεξιά, Πάχος αριστερά, Ύψος κάτω. */
export const WEDGE_ANGLES: Record<RingFieldKey, { centerDeg: number; a0: number; a1: number }> = {
  length: { centerDeg: 270, a0: 225, a1: 315 }, // top (N)
  angle: { centerDeg: 0, a0: -45, a1: 45 }, // right (E)
  thickness: { centerDeg: 180, a0: 135, a1: 225 }, // left (W)
  height: { centerDeg: 90, a0: 45, a1: 135 }, // bottom (S)
};

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

/** Σε ποιο cardinal wedge πέφτει μια γωνία (μοίρες, y-κάτω). */
export function wedgeAtAngle(deg: number): RingFieldKey {
  const a = ((deg % 360) + 360) % 360;
  if (a >= 225 && a < 315) return 'length'; // top
  if (a >= 45 && a < 135) return 'height'; // bottom
  if (a >= 135 && a < 225) return 'thickness'; // left
  return 'angle'; // right (315..360, 0..45)
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

/** Επόμενο/προηγούμενο πεδίο στον κύκλο TAB (Shift+TAB = ανάποδα), wrap-around. */
export function nextRingField(current: RingFieldKey, shift: boolean): RingFieldKey {
  const i = RING_TAB_ORDER.indexOf(current);
  const len = RING_TAB_ORDER.length;
  return RING_TAB_ORDER[(i + (shift ? len - 1 : 1)) % len];
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
