/**
 * ADR-363 §5.7 — **Side-face auto-flush** για freehand δοκάρι (geometric variant).
 *
 * Δομικός κανόνας (Revit/ETABS-grade, ίδιος με το grid): ένα δοκάρι που πλαισιώνεται από
 * κολόνα στήριξης πρέπει να **πατά flush** στην παρειά της (full bearing), όχι να εμφανίζεται
 * centered/έκκεντρα. Το grid το πετυχαίνει μέσω `resolveColumnAwareJustification` — αλλά αυτό
 * απαιτεί **guide bindings** (κοινός perpendicular άξονας κολόνας↔δοκαριού). Το freehand δεν
 * έχει bindings, οπότε εδώ επιλέγουμε το justification **γεωμετρικά**:
 *
 *   - canonical normal `n` του άξονα (SSoT `canonicalAxisNormal` — orientation-invariant)
 *   - για κάθε κολόνα που πλαισιώνει ΑΚΡΟ του δοκαριού (το άκρο μέσα στο bbox της — ο χρήστης
 *     έκανε snap στη γωνία/παρειά της, ADR-370): η **κατεύθυνση του κέντρου της** ως προς τον
 *     άξονα (`d = (centroid − E)·n`) δείχνει προς ποια πλευρά «κάθεται» η κολόνα.
 *   - `d > 0` → σώμα προς +n → `'left'`· `d < 0` → σώμα προς −n → `'right'` (η γραμμή κλικ =
 *     παρειά, το σώμα εκτείνεται **προς το εσωτερικό της κολόνας** → flush όψη + full bearing).
 *
 * Το αποτέλεσμα τροφοδοτεί το ΥΠΑΡΧΟΝ `anchorBeamPlacementAxis`/`justifyGridSegment` (καμία
 * νέα offset math) — αντικαθιστά μόνο το σταθερό default `'left'`. Χωρίς κολόνα-αναφορά ή σε
 * σύγκρουση (κολόνες εκατέρωθεν) → `fallback` (το default του χρήστη), μηδέν regression.
 *
 * Pure + unit-testable· καμία γνώση σκηνής/React. Τα column footprints είναι world-baked
 * (`computeColumnGeometry`) → λοξές/σύνθετες κολόνες δουλεύουν. Reuse: `canonicalAxisNormal`
 * (το ΜΟΝΟ μη-τετριμμένο shared math)· bbox/centroid τοπικά (trivial 2Δ primitives, Point2D —
 * αποφυγή edit στο shared `polygon-utils` που είναι `Point3D`-typed, shared-tree).
 *
 * @see ./grid-segment-justification.ts — εφαρμόζει το (επιλεγμένο) justification
 * @see ../grid/grid-column-aware-justification.ts — η grid (bindings-based) εκδοχή
 * @see ../grid/axis-normal.ts — canonicalAxisNormal (shared SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7
 */

import type { Point2D } from '../../rendering/types/Types';
import type { StripJustification } from '../types/foundation-types';
import { canonicalAxisNormal } from '../grid/axis-normal';

/** Κάτω από αυτό το |d| (perpendicular offset κέντρου από άξονα) → καμία προτίμηση πλευράς. */
const FLUSH_D_EPS = 1e-6;

interface Bbox2D {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

function bboxOf(pts: readonly Point2D[]): Bbox2D {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}

/** Vertex-average centroid (επαρκές για κυρτές column footprints — direction-only χρήση). */
function centroidOf(pts: readonly Point2D[]): Point2D {
  let sx = 0, sy = 0;
  for (const p of pts) { sx += p.x; sy += p.y; }
  return { x: sx / pts.length, y: sy / pts.length };
}

/** Το σημείο `E` μέσα στο (διογκωμένο κατά `tol`) bbox της κολόνας — ο χρήστης έκανε snap εκεί. */
function pointInBbox(E: Readonly<Point2D>, bb: Bbox2D, tol: number): boolean {
  return E.x >= bb.minX - tol && E.x <= bb.maxX + tol && E.y >= bb.minY - tol && E.y <= bb.maxY + tol;
}

/**
 * Επίλεξε το placement justification ενός freehand δοκαριού ώστε η πλευρική παρειά του να
 * ευθυγραμμίζεται flush με την παρειά της κολόνας που πλαισιώνει ΑΚΡΟ του (full bearing).
 *
 * @param start/end          Τα clicked (raw, ΠΡΟ-anchor) άκρα του άξονα.
 * @param columnFootprints   World-baked column footprints (2Δ). `[]` → `fallback`.
 * @param fallback           Το justification του χρήστη (default 'left') όταν δεν υπάρχει
 *                           κολόνα-αναφορά ή κολόνες βρίσκονται εκατέρωθεν (σύγκρουση).
 * @param tol                Ανοχή (scene units) για «άκρο μέσα στην κολόνα» (default ~0, ο
 *                           snap δίνει ακριβή γωνία/παρειά).
 */
export function resolveBeamColumnFlushJustification(
  start: Readonly<Point2D>,
  end: Readonly<Point2D>,
  columnFootprints: readonly (readonly Point2D[])[],
  fallback: StripJustification,
  tol = 1e-6,
): StripJustification {
  if (columnFootprints.length === 0) return fallback;
  const n = canonicalAxisNormal(start, end);
  if (!n) return fallback; // degenerate (μηδενικού μήκους) άξονας

  let desiredSign: number | null = null; // +1 → 'left', −1 → 'right'
  for (const fp of columnFootprints) {
    if (fp.length < 3) continue;
    const bb = bboxOf(fp);
    const atStart = pointInBbox(start, bb, tol);
    const atEnd = pointInBbox(end, bb, tol);
    if (!atStart && !atEnd) continue; // κολόνα δεν πλαισιώνει άκρο → αγνόησέ την
    const c = centroidOf(fp);
    const E = atStart ? start : end;
    // n ⊥ άξονα → (c−E)·n = signed perpendicular offset του κέντρου από τη γραμμή του άξονα.
    const d = (c.x - E.x) * n.nx + (c.y - E.y) * n.ny;
    if (Math.abs(d) < FLUSH_D_EPS) continue; // κέντρο πάνω στον άξονα → καμία προτίμηση
    const sign = d > 0 ? 1 : -1;
    if (desiredSign === null) desiredSign = sign;
    else if (desiredSign !== sign) return fallback; // κολόνες εκατέρωθεν → κράτα το default
  }

  if (desiredSign === null) return fallback;
  return desiredSign > 0 ? 'left' : 'right';
}
