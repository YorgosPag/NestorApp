/**
 * @fileoverview **ΠΕΡΙΓΡΑΜΜΑ ΜΟΝΑΔΑΣ → ΘΕΣΗ ΠΑΝΩ ΣΤΗΝ ΕΙΚΟΝΑ ΤΟΥ ΟΡΟΦΟΥ** — μία κανονικοποίηση, δύο κάδρα (ADR-907 §11).
 * @related lib/listings/floorplan-render-recipe (`frame`) · lib/geometry/planar-polygon · ADR-907 §11.1 (η μέτρηση Υ2)
 * @module lib/listings/floor-plate/floor-plate-outline
 *
 * Τα περιγράμματα (`floorplan_overlays`) ζουν στον **εγγενή χώρο του υποβάθρου**, με Y **προς τα πάνω**: συντεταγμένες
 * σκηνής για σχέδιο, pixels για ανεβασμένη εικόνα. Η δημόσια σελίδα θέλει **κλάσματα της εικόνας**, από πάνω-αριστερά
 * — ίδια σύμβαση με το σημείο λήψης (`photo-capture-spot`), ώστε κάθε παράγωγο του ραφιού να μοιράζεται το ίδιο σχήμα.
 *
 * | Πηγή εικόνας | Κάδρο |
 * |---|---|
 * | λήψη από το σχέδιο (ADR-909) | `renderRecipe.frame` — το ορθογώνιο του **σχεδίου** που δείχνουν τα pixels |
 * | ανεβασμένη εικόνα | `{0, 0, W, H}` — τα **φυσικά** pixels των bytes |
 *
 * 🔑 **Ένας τύπος**: `u = (x − minX) / ΔX`, `v = (maxY − y) / ΔY`. Μετρημένο (Υ2): 0,078 px στα 2560 px, και αυτό μόνο
 * επειδή η μέτρηση στρογγύλεψε το ύψος της εικόνας· με κάδρο που βγαίνει από τα ίδια τα pixels, μηδέν.
 *
 * ⛔ **ΠΟΤΕ το `processedData.bounds` του αρχείου ως κάδρο**: κρατά τα όρια του πρωτότυπου DXF, ενώ η σκηνή (και τα
 * περιγράμματα) είναι μετατοπισμένα κατά `sourceOrigin` (§11.1).
 *
 * ⚠️ **Καθαρό module** — κανένα React, καμία I/O.
 */

import { polygonArea, type PlanarPoint } from '@/lib/geometry/planar-polygon';

import type { FloorplanRenderRecipe } from '../floorplan-render-recipe';

/** Ορθογώνιο στον εγγενή χώρο του υποβάθρου (Y προς τα πάνω) — το **ίδιο** σχήμα με το κάδρο της συνταγής. */
export type FloorPlateFrame = FloorplanRenderRecipe['frame'];

/** Από πού ήρθε η εικόνα του ορόφου — και άρα σε ποιον χώρο μετριούνται τα περιγράμματα. */
export type FloorPlateImageSource =
  | { readonly kind: 'capture'; readonly recipe: Pick<FloorplanRenderRecipe, 'frame' | 'widthPx' | 'heightPx'> }
  | { readonly kind: 'upload'; readonly widthPx: number; readonly heightPx: number };

/**
 * Το ταβάνι κορυφών ενός περιγράμματος. Ένα διαμέρισμα σχεδιασμένο με το χέρι έχει 4–20· πάνω από αυτό το όριο το
 * σχήμα είναι ίχνος καμπύλης, και το δημόσιο έγγραφο (που ταξιδεύει ολόκληρο στο HTML) δεν το σηκώνει.
 */
export const FLOOR_PLATE_OUTLINE_MAX_VERTICES = 128;

const MIN_VERTICES = 3;
/** Ψηφία κλάσματος που αποθηκεύονται: 10⁻⁵ της εικόνας = 0,026 px στα 2560 px. */
const OUTLINE_DECIMALS = 5;
const OUTLINE_QUANTUM = 10 ** OUTLINE_DECIMALS;
/**
 * Πόσο **έξω** από το κάδρο συγχωρείται μια κορυφή (κλάσμα της πλευράς) — θόρυβος κινητής υποδιαστολής σε κορυφή
 * κουμπωμένη πάνω στην ακμή. Οτιδήποτε μεγαλύτερο είναι περίγραμμα που **δεν ανήκει** σε αυτή την εικόνα.
 */
const EDGE_TOLERANCE = 1e-6;
/** Κάτω από αυτό το εμβαδόν (κλάσμα της εικόνας) το σχήμα είναι γραμμή ή σημείο — δεν πατιέται, δεν φαίνεται. */
const MIN_OUTLINE_AREA = 1e-8;

/** Γιατί ένα περίγραμμα **δεν** βγαίνει στο κοινό — με όνομα, ώστε η επιμέλεια να πει στον άνθρωπο τι να διορθώσει. */
export type FloorPlateOutlineRefusal =
  | 'too-few-vertices'
  | 'too-many-vertices'
  | 'not-finite'
  | 'outside-frame'
  | 'degenerate';

export type FloorPlateOutlineReading =
  | { readonly ok: true; readonly outline: readonly number[] }
  | { readonly ok: false; readonly why: FloorPlateOutlineRefusal };

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** Λέει το κάδρο τον **ίδιο** λόγο πλευρών με τα pixels; Ανοχή ένα pixel στην κοντή πλευρά. */
function frameMatchesRaster(frame: FloorPlateFrame, widthPx: number, heightPx: number): boolean {
  const spanX = frame.maxX - frame.minX;
  const spanY = frame.maxY - frame.minY;
  if (!positive(spanX) || !positive(spanY)) return false;
  const skew = Math.abs(spanX * heightPx - spanY * widthPx) / (spanY * widthPx);
  return skew <= 1 / Math.min(widthPx, heightPx);
}

/**
 * **Το κάδρο της εικόνας**, ή `null` όταν η πηγή δεν μπορεί να δώσει κάδρο.
 *
 * 🔑 Για τη λήψη ελέγχεται ότι το κάδρο έχει τον λόγο πλευρών των pixels: η μηχανή ADR-909 το παράγει **αντιστρέφοντας**
 * τον μετασχηματισμό που ζωγράφισε, άρα ισχύει εκ κατασκευής — συνταγή όπου δεν ισχύει είναι αλλοιωμένη, και θα έβαζε
 * κάθε περίγραμμα σε λάθος θέση **χωρίς σφάλμα**.
 */
export function floorPlateFrameOf(source: FloorPlateImageSource): FloorPlateFrame | null {
  if (source.kind === 'upload') {
    if (!positive(source.widthPx) || !positive(source.heightPx)) return null;
    return { minX: 0, minY: 0, maxX: source.widthPx, maxY: source.heightPx };
  }
  const { frame, widthPx, heightPx } = source.recipe;
  if (!positive(widthPx) || !positive(heightPx)) return null;
  return frameMatchesRaster(frame, widthPx, heightPx) ? frame : null;
}

/** Κλειστό σχήμα χωρίς επανάληψη της πρώτης κορυφής στο τέλος — η μορφή που περιμένει το `planar-polygon`. */
function withoutClosingVertex(vertices: readonly PlanarPoint[]): readonly PlanarPoint[] {
  if (vertices.length < 2) return vertices;
  const first = vertices[0];
  const last = vertices[vertices.length - 1];
  return first.x === last.x && first.y === last.y ? vertices.slice(0, -1) : vertices;
}

/** Κλάσμα στο [0,1], ή `null` όταν πέφτει έξω πέρα από την ανοχή. Το αποτέλεσμα είναι ήδη κβαντισμένο. */
function fractionOf(distance: number, span: number): number | null {
  const raw = distance / span;
  if (!Number.isFinite(raw)) return null;
  if (raw < -EDGE_TOLERANCE || raw > 1 + EDGE_TOLERANCE) return null;
  return Math.round(Math.min(1, Math.max(0, raw)) * OUTLINE_QUANTUM) / OUTLINE_QUANTUM;
}

type Projection =
  | { readonly ok: true; readonly points: readonly PlanarPoint[] }
  | { readonly ok: false; readonly why: 'not-finite' | 'outside-frame' };

/** Κάθε κορυφή στον χώρο της εικόνας (από πάνω-αριστερά)· διαδοχικές κορυφές που ο κβαντισμός ταύτισε πέφτουν. */
function projectOntoImage(vertices: readonly PlanarPoint[], frame: FloorPlateFrame): Projection {
  const spanX = frame.maxX - frame.minX;
  const spanY = frame.maxY - frame.minY;
  const points: PlanarPoint[] = [];
  for (const vertex of vertices) {
    if (!Number.isFinite(vertex.x) || !Number.isFinite(vertex.y)) return { ok: false, why: 'not-finite' };
    const x = fractionOf(vertex.x - frame.minX, spanX);
    const y = fractionOf(frame.maxY - vertex.y, spanY);
    if (x === null || y === null) return { ok: false, why: 'outside-frame' };
    const previous = points[points.length - 1];
    if (previous === undefined || previous.x !== x || previous.y !== y) points.push({ x, y });
  }
  return { ok: true, points: withoutClosingVertex(points) };
}

/**
 * **Περίγραμμα στον χώρο του υποβάθρου → επίπεδος πίνακας `x0, y0, x1, y1, …` σε κλάσματα της εικόνας.**
 *
 * 🔑 **Επίπεδος** και όχι `[x, y][]`: το Firestore δεν δέχεται πίνακα μέσα σε πίνακα.
 * 🔑 **Απόρριψη, ποτέ κόψιμο**: περίγραμμα που βγαίνει από το κάδρο δεν «σφηνώνεται» στην ακμή — θα έδειχνε στο κοινό
 * ένα σχήμα που κανείς δεν σχεδίασε. Ο όροφος μένει αδημοσίευτος και ο άνθρωπος μαθαίνει γιατί.
 */
export function normalizeFloorPlateOutline(
  vertices: readonly PlanarPoint[],
  frame: FloorPlateFrame,
): FloorPlateOutlineReading {
  const ring = withoutClosingVertex(vertices);
  if (ring.length < MIN_VERTICES) return { ok: false, why: 'too-few-vertices' };
  if (ring.length > FLOOR_PLATE_OUTLINE_MAX_VERTICES) return { ok: false, why: 'too-many-vertices' };

  const projected = projectOntoImage(ring, frame);
  if (!projected.ok) return projected;
  if (projected.points.length < MIN_VERTICES) return { ok: false, why: 'degenerate' };
  if (polygonArea(projected.points) < MIN_OUTLINE_AREA) return { ok: false, why: 'degenerate' };

  return { ok: true, outline: projected.points.flatMap((point) => [point.x, point.y]) };
}

function isUnitFraction(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

/**
 * **Η μία ανάγνωση αποθηκευμένου περιγράμματος** (πλευρά επισκέπτη) — ποτέ δεν πετά. Άκυρο ⇒ `null`.
 *
 * Το δημόσιο έγγραφο διαβάζεται **ρηχά** (`public-listing-schema`), άρα ο αναγνώστης δεν δανείζεται την εμπιστοσύνη
 * του γραφέα: ζυγός αριθμός κλασμάτων στο [0,1], μέσα στα ίδια όρια κορυφών.
 */
export function readFloorPlateOutline(value: unknown): readonly number[] | null {
  if (!Array.isArray(value) || value.length % 2 !== 0) return null;
  const count = value.length / 2;
  if (count < MIN_VERTICES || count > FLOOR_PLATE_OUTLINE_MAX_VERTICES) return null;
  return value.every(isUnitFraction) ? value : null;
}
