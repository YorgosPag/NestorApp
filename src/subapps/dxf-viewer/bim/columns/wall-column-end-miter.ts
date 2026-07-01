/**
 * ADR-363 §wall-column-end-miter — Revit-grade trapezoidal cut of a wall END
 * against a COLUMN face.
 *
 * Πρόβλημα: όταν ένας τοίχος τοποθετείται **υπό γωνία** με άκρο πάνω σε υφιστάμενη
 * κολόνα, το άκρο κόβεται **κάθετα στον άξονά του** (square end-cap) και μένει κενό /
 * λοξό χάσμα ανάμεσα στη παρειά του τοίχου και την παρειά της κολόνας.
 *
 * Λύση (όπως Revit / AutoCAD Architecture): το άκρο κόβεται **πάνω στην ευθεία της
 * παρειάς της κολόνας** — οι δύο παρειές (outer/inner) του τοίχου τμήνουν την ΙΔΙΑ
 * ευθεία σε **δύο διαφορετικά σημεία** → τραπεζοειδές άκρο, μηδέν κενό. Σε 90° οι δύο
 * τομές πέφτουν στο ίδιο διαμήκες σημείο → το τραπέζιο εκφυλίζεται φυσικά σε ίσιο άκρο
 * (ΕΝΑ code path, μηδέν branches — όπως οι μεγάλοι). Η κολόνα κερδίζει: ο τοίχος σταματά
 * στην παρειά, δεν τη διαπερνά.
 *
 * SSoT reuse (μηδέν νέο geometry primitive):
 *   - `lineLineIntersect` / `MITER_MAX_EXTENSION_FRACTION` / `MiterPt` — wall-trims-geometry.
 *   - `projectPolygonOnAxis` — polygon-utils (κατά πόσο ο άξονας διαπερνά το footprint).
 * Το αποτέλεσμα (`startMiter` / `endMiter`) είναι ΤΟ ΙΔΙΟ `MiterPt` που παράγει το wall↔wall
 * miter, οπότε ρέει αυτόματα στο `computeWallGeometry` (Phase 1D-C edge override) — ίδιο
 * rendering path, μηδέν νέος μηχανισμός.
 *
 * Pure & idempotent — καθαρή συνάρτηση των τρεχουσών θέσεων τοίχου + footprints.
 * Μόνο `kind === 'straight'` (όπως και το wall↔wall miter).
 *
 * @see bim/walls/wall-trims.ts — computeWallTrims (Pass 3 caller) + JOIN_THRESHOLD_MM
 * @see bim/geometry/wall-geometry.ts — startMiter/endMiter → outer/inner edge override
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §wall-column-end-miter
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WallEntity } from '../types/wall-types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { lineLineIntersect, MITER_MAX_EXTENSION_FRACTION, type MiterPt } from '../walls/wall-trims-geometry';
import { JOIN_THRESHOLD_MM } from '../walls/wall-trims';
import { projectPolygonOnAxis } from '../geometry/shared/polygon-utils';

/** Παράμετρος edge στο [0,1] — μικρή ανοχή στα άκρα του τμήματος (γωνίες footprint). */
const EDGE_PARAM_EPS = 1e-6;

/** Column end-miter αποτέλεσμα — ίδια δομή με το wall↔wall trim patch (start/end). */
export interface WallColumnEndMiter {
  readonly startMiter?: MiterPt;
  readonly endMiter?: MiterPt;
}

/**
 * Υπολόγισε το τραπεζοειδές κόψιμο (`startMiter`/`endMiter`) ενός straight τοίχου του
 * οποίου κάποιο άκρο ακουμπά κολόνα. Επιστρέφει `null` όταν κανένα άκρο δεν κουμπώνει
 * σε κολόνα (μηδέν αλλαγή). Kind-agnostic ως προς το σχήμα της κολόνας (rect/L/T/polygon)
 * — δουλεύει απευθείας στο world footprint polygon.
 */
export function computeWallColumnEndMiter(
  wall: WallEntity,
  columnFootprints: readonly (readonly Point2D[])[],
  sceneUnits: SceneUnits,
): WallColumnEndMiter | null {
  if (wall.kind !== 'straight' || columnFootprints.length === 0) return null;

  const { start, end, thickness, flip } = wall.params;
  const s = mmToSceneUnits(wall.params.sceneUnits ?? sceneUnits);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  // Degenerate-wall guard EXPRESSED IN SCENE UNITS (mirror wall-trims Phase 1L): "1mm",
  // not a hardcoded "1" that would mean 1 METRE in a metres-scene drawing.
  if (len < s) return null;

  const ux = dx / len;
  const uy = dy / len;
  // Signed half-thickness — SAME convention as wall-geometry outerEdge / cornerMiter:
  // outer = tip + (-uy, ux)·halfSigned (CCW perpendicular), inner = tip − (…). sign = flip?-1:1.
  const halfSigned = (flip ? -1 : 1) * (thickness / 2) * s;
  const thr = JOIN_THRESHOLD_MM * s;

  const startMiter = resolveEndMiter(start, end, ux, uy, halfSigned, len, columnFootprints, thr);
  const endMiter = resolveEndMiter(end, start, ux, uy, halfSigned, len, columnFootprints, thr);
  if (!startMiter && !endMiter) return null;

  return {
    ...(startMiter ? { startMiter } : {}),
    ...(endMiter ? { endMiter } : {}),
  };
}

/**
 * Miter για ΕΝΑ άκρο (`tip`). `far` = το αντίθετο άκρο (ορίζει την κατεύθυνση εισόδου).
 * (1) βρίσκει την κολόνα που ο άξονας διαπερνά κοντά στο `tip`, (2) επιλέγει την παρειά
 * εισόδου (entry face), (3) τμήνει τις outer/inner ευθείες του τοίχου με αυτή. `null` όταν
 * καμία κολόνα δεν κουμπώνει ή η παρειά είναι παράλληλη στον άξονα (γλίστρημα, όχι end-butt).
 */
function resolveEndMiter(
  tip: Readonly<Point2D>,
  far: Readonly<Point2D>,
  ux: number,
  uy: number,
  halfSigned: number,
  len: number,
  columnFootprints: readonly (readonly Point2D[])[],
  thr: number,
): MiterPt | null {
  // ── (1) Capture: κολόνα που ο άξονας ΔΙΑΠΕΡΝΑ (perp straddle) κοντά στο tip ──────────
  let best: readonly Point2D[] | null = null;
  let bestGap = Infinity;
  for (const fp of columnFootprints) {
    if (fp.length < 3) continue;
    // Προβολή στο άξονα με origin=tip: along/perp σχετικά με το άκρο (reuse SSoT).
    const proj = projectPolygonOnAxis(fp, tip.x, tip.y, ux, uy);
    const straddles = proj.perpMin <= 0 && proj.perpMax >= 0; // κορυφές εκατέρωθεν → τέμνει τον άξονα
    if (!straddles) continue;
    // Απόσταση (κατά μήκος άξονα) του tip από την έκταση [alongMin, alongMax] του footprint.
    // 0 όταν το tip βρίσκεται ΜΕΣΑ στο footprint· αλλιώς το κενό ως την πλησιέστερη παρειά.
    const gap = proj.alongMin > 0 ? proj.alongMin : (proj.alongMax < 0 ? -proj.alongMax : 0);
    if (gap > thr) continue;
    if (gap < bestGap) {
      bestGap = gap;
      best = fp;
    }
  }
  if (!best) return null;

  return miterAtFootprintFace(tip, far, ux, uy, halfSigned, len, best);
}

/**
 * (2) entry-face selection + (3) miter points. Ο άξονας-ευθεία (μέσω tip, dir u) τμήνει
 * τις ακμές του footprint· entry face = η ΠΡΩΤΗ που συναντάς ερχόμενος κατά την κατεύθυνση
 * εισόδου (from `far` προς `tip`). Στη συνέχεια οι outer/inner ευθείες του τοίχου τμήνουν
 * αυτή την παρειά → τα δύο σημεία του `MiterPt`.
 */
function miterAtFootprintFace(
  tip: Readonly<Point2D>,
  far: Readonly<Point2D>,
  ux: number,
  uy: number,
  halfSigned: number,
  len: number,
  fp: readonly Point2D[],
): MiterPt | null {
  // Κατεύθυνση εισόδου (μοναδιαία) = από far προς tip = ±(ux, uy).
  const edx = tip.x - far.x;
  const edy = tip.y - far.y;
  const elen = Math.hypot(edx, edy) || 1;
  const entX = edx / elen;
  const entY = edy / elen;

  let faceA: Point2D | null = null;
  let faceB: Point2D | null = null;
  let bestKey = Infinity;
  const n = fp.length;
  for (let i = 0; i < n; i++) {
    const vA = fp[i];
    const vB = fp[(i + 1) % n];
    const isect = lineLineIntersect(tip.x, tip.y, tip.x + ux, tip.y + uy, vA.x, vA.y, vB.x, vB.y);
    if (!isect) continue;
    if (isect.u < -EDGE_PARAM_EPS || isect.u > 1 + EDGE_PARAM_EPS) continue; // εκτός τμήματος ακμής
    // Σημείο τομής στον άξονα: P = tip + t·u. key = προβολή κατά την είσοδο → μικρότερο = entry.
    const px = tip.x + isect.t * ux;
    const py = tip.y + isect.t * uy;
    const key = (px - far.x) * entX + (py - far.y) * entY;
    if (key < bestKey) {
      bestKey = key;
      faceA = vA;
      faceB = vB;
    }
  }
  if (!faceA || !faceB) return null;

  // (3) outer/inner ευθείες του τοίχου (παράλληλες στον άξονα, offset ±halfSigned κατά CCW ⟂).
  const perpX = -uy;
  const perpY = ux;
  const outerX = tip.x + perpX * halfSigned;
  const outerY = tip.y + perpY * halfSigned;
  const innerX = tip.x - perpX * halfSigned;
  const innerY = tip.y - perpY * halfSigned;

  const outerI = lineLineIntersect(outerX, outerY, outerX + ux, outerY + uy, faceA.x, faceA.y, faceB.x, faceB.y);
  const innerI = lineLineIntersect(innerX, innerY, innerX + ux, innerY + uy, faceA.x, faceA.y, faceB.x, faceB.y);
  // Παράλληλη παρειά στον άξονα → ο τοίχος γλιστρά κατά μήκος της, δεν είναι end-butt.
  if (!outerI || !innerI) return null;

  // Overflow guard (reuse SSoT fraction): το τραπέζιο δεν επεκτείνεται πέρα από το μήκος του
  // τοίχου (αφύσικο spike σε σχεδόν-παράλληλη παρειά) → skip.
  const maxExt = MITER_MAX_EXTENSION_FRACTION * len;
  if (Math.abs(outerI.t) > maxExt || Math.abs(innerI.t) > maxExt) return null;

  return {
    outer: { x: outerX + outerI.t * ux, y: outerY + outerI.t * uy },
    inner: { x: innerX + innerI.t * ux, y: innerY + innerI.t * uy },
  };
}
