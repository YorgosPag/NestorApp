/**
 * ADR-441 — trim grid line-segment endpoints to column FACES (Revit-grade, frame-into).
 *
 * **Kind-agnostic SSoT.** Όταν ένα γραμμικό δομικό στοιχείο (τοίχος ή δοκός) παράγεται
 * «από κάναβο» πάνω σε κάναβο που έχει ήδη ΚΟΛΩΝΕΣ στις τομές, το στοιχείο έχει
 * centerline ΠΑΝΩ στον άξονα → τα άκρα του πέφτουν στο **κέντρο** της κολώνας
 * (επικάλυψη). Στη Revit το στοιχείο σταματά στην **παρειά** της κολώνας (clear span /
 * frame-into).
 *
 * SSoT μηχανισμός = το ΥΠΑΡΧΟΝ `GuideBinding.extend` (mm signed, follow-move-safe): το
 * άκρο τραβιέται πίσω από τον άξονα κατά την **προβολή του footprint της κολώνας στη
 * διεύθυνση του στοιχείου** (support distance). Επειδή το extend είναι σταθερή απόσταση
 * *σχετικά* με τον άξονα, η παρειά μένει στην κολώνα ακόμη κι όταν μετακινηθεί ο άξονας
 * (ο ίδιος ο κάναβος μετακινεί ΚΑΙ την κολώνα — center-x/center-y bound — ΚΑΙ το άκρο·
 * persist round-trips στα bindings).
 *
 * Consumers: `wall-from-grid` (μέσω `wall-column-trim` shim) + `beam-from-grid`.
 *
 * @see bim/hosting/guide-binding-types.ts — GuideBinding.extend
 * @see bim/hosting/derive-slots.ts — honors extend στο follow-move
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §8
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnEntity } from '../types/column-types';
import type { GuideBinding, GuideBindingSlot } from '../hosting/guide-binding-types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { projectPointOnAxis, projectPolygonOnAxis } from '../geometry/shared/polygon-utils';

/** Tolerance (mm) center-match κολώνας↔άκρου στοιχείου (grid columns κάθονται ακριβώς στην τομή). */
const COLUMN_MATCH_TOL_MM = 5;

export interface SegmentColumnTrimResult {
  readonly start: Point2D;
  readonly end: Point2D;
  readonly bindings: readonly GuideBinding[];
}

/**
 * Max προβολή (scene units) του column footprint στη μοναδιαία διεύθυνση `dir`, από
 * το κέντρο = η «support distance» (μισό πλάτος κολώνας στη διεύθυνση του στοιχείου).
 * Exported (N.0.2 SSoT) — το ίδιο κριτήριο frame-into χρησιμοποιεί και ο
 * `findColumnsFramedByBeam` (column→beam attach detection).
 */
export function columnSupportAlong(column: ColumnEntity, dirX: number, dirY: number): number {
  const cx = column.params.position.x;
  const cy = column.params.position.y;
  let best = 0;
  for (const v of column.geometry.footprint.vertices) {
    const proj = (v.x - cx) * dirX + (v.y - cy) * dirY;
    if (proj > best) best = proj;
  }
  return best;
}

/**
 * Προβολή του κέντρου μιας κολώνας πάνω στην ευθεία ενός γραμμικού άξονα (scene units).
 * `along` = διαμήκης θέση `(center − a)·u` (μπορεί <0 ή >μήκος)· `perp` = |κάθετη απόσταση|
 * από την ευθεία. Exported SSoT (N.0.2) — κοινό από το `beamFramesColumn` (framing
 * detection, +span-clamp) ΚΑΙ το `reframeBeamEndpointsToColumns` (ADR-492 per-end
 * συσχέτιση, +collinearity threshold). Kind-agnostic: ο caller δίνει το (a, u) του άξονα.
 */
export interface AxisColumnProjection {
  readonly along: number;
  readonly perp: number;
}
export function projectColumnCenterOnAxis(
  column: ColumnEntity,
  ax: number,
  ay: number,
  ux: number,
  uy: number,
): AxisColumnProjection {
  const rx = column.params.position.x - ax;
  const ry = column.params.position.y - ay;
  return { along: rx * ux + ry * uy, perp: Math.abs(rx * uy - ry * ux) };
}

/** Footprint-aware προβολή κολώνας σε άξονα (ADR-494). */
export interface AxisFootprintProjection {
  /** Διαμήκης θέση εγγύτερης κορυφής footprint από το `a`, κατά `u` (scene units). */
  readonly alongMin: number;
  /** Διαμήκης θέση απώτερης κορυφής footprint. */
  readonly alongMax: number;
  /** Ελάχιστη κάθετη απόσταση footprint→ευθεία· **0** όταν το footprint τέμνει τον άξονα. */
  readonly perp: number;
}

/**
 * Footprint-aware προβολή κολώνας πάνω στην ευθεία ενός γραμμικού άξονα — **kind-agnostic
 * SSoT (ADR-494)**. Σε αντίθεση με το {@link projectColumnCenterOnAxis} (που κοιτά ΜΟΝΟ το
 * insertion point `params.position` → σπάει για ασύμμετρες διατομές L/T/U/I/τοιχείο, όπου
 * το `position` δεν είναι κεντροειδές/σημείο επαφής), εδώ προβάλλονται **ΟΛΕΣ οι κορυφές
 * του πραγματικού `geometry.footprint`** (το ίδιο περίγραμμα που σκαλίζει `computeColumnGeometry`
 * ανά kind):
 *   · `perp` = ελάχιστη κάθετη απόσταση του footprint από την ευθεία· **0** όταν κορυφές
 *     βρίσκονται εκατέρωθεν (το footprint **τέμνει** τον άξονα) → στήριξη ανεξαρτήτως σχήματος.
 *   · `[alongMin, alongMax]` = διαμήκης έκταση footprint κατά μήκος του άξονα — οι ΠΑΡΕΙΕΣ
 *     (alongMax = παρειά προς +u, alongMin = παρειά προς −u), position-independent.
 *
 * **Thin entity wrapper** πάνω στο pure `projectPolygonOnAxis` (polygon-utils SSoT) — μηδέν
 * δικός μου vertex loop. Προσθέτει ΜΟΝΟ τη framing-semantic: το footprint που **τέμνει** τον
 * άξονα (πρόσημα κάθετης εκατέρωθεν) → `perp = 0`· αλλιώς η ελάχιστη απόλυτη κάθετη απόσταση.
 * Κοινό από `beamFramesColumn` (framing/graph) ΚΑΙ `reframeBeamEndpointsToColumns` (ADR-492).
 * Degenerate footprint (<1 κορυφή) → fallback στο `position` ως σημείο (μηδέν crash).
 */
export function projectColumnFootprintOnAxis(
  column: ColumnEntity,
  ax: number,
  ay: number,
  ux: number,
  uy: number,
): AxisFootprintProjection {
  const verts = column.geometry?.footprint?.vertices ?? [];
  if (verts.length === 0) {
    const c = projectPointOnAxis(column.params.position.x, column.params.position.y, ax, ay, ux, uy);
    return { alongMin: c.along, alongMax: c.along, perp: c.perp };
  }
  const { alongMin, alongMax, perpMin, perpMax } = projectPolygonOnAxis(verts, ax, ay, ux, uy);
  const straddles = perpMin <= 0 && perpMax >= 0; // κορυφές εκατέρωθεν → τέμνει την ευθεία
  const perp = straddles ? 0 : Math.min(Math.abs(perpMin), Math.abs(perpMax));
  return { alongMin, alongMax, perp };
}

/** Η πλησιέστερη κολώνα της οποίας το κέντρο πέφτει εντός `tol` (scene units) του σημείου. */
function findColumnAtPoint(
  columns: readonly ColumnEntity[],
  x: number,
  y: number,
  tol: number,
): ColumnEntity | null {
  let best: ColumnEntity | null = null;
  let bestDist = tol;
  for (const c of columns) {
    const dist = Math.hypot(c.params.position.x - x, c.params.position.y - y);
    if (dist <= bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Τράβα τα άκρα ενός γραμμικού segment στις παρειές των κολωνών που κάθονται πάνω τους.
 * Επιστρέφει το input αμετάβλητο όταν δεν υπάρχει κολώνα σε κανένα άκρο (μηδέν trim). Το
 * extend μπαίνει στο running-direction slot (κατακόρυφος → start/end-y· οριζόντιος →
 * start/end-x).
 */
export function trimSegmentEndpointsToColumns(
  start: Readonly<Point2D>,
  end: Readonly<Point2D>,
  bindings: readonly GuideBinding[],
  columns: readonly ColumnEntity[],
  sceneUnits: SceneUnits,
): SegmentColumnTrimResult {
  if (columns.length === 0) return { start, end, bindings };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { start, end, bindings };

  const ux = dx / len;
  const uy = dy / len;
  const scenerPerMm = mmToSceneUnits(sceneUnits);
  const tol = COLUMN_MATCH_TOL_MM * scenerPerMm;

  const startCol = findColumnAtPoint(columns, start.x, start.y, tol);
  const endCol = findColumnAtPoint(columns, end.x, end.y, tol);
  const sTrim = startCol ? columnSupportAlong(startCol, ux, uy) : 0; // παρειά προς +d
  const eTrim = endCol ? columnSupportAlong(endCol, -ux, -uy) : 0; // παρειά προς −d
  if (sTrim <= 0 && eTrim <= 0) return { start, end, bindings };

  const vertical = Math.abs(uy) >= Math.abs(ux);
  const startSlot: GuideBindingSlot = vertical ? 'start-y' : 'start-x';
  const endSlot: GuideBindingSlot = vertical ? 'end-y' : 'end-x';
  const mmPerScene = 1 / scenerPerMm;

  const nextStart: Point2D = { ...start, x: start.x + ux * sTrim, y: start.y + uy * sTrim };
  const nextEnd: Point2D = { ...end, x: end.x - ux * eTrim, y: end.y - uy * eTrim };
  const nextBindings = bindings.map((b) => {
    if (b.slot === startSlot && sTrim > 0) return { ...b, extend: (b.extend ?? 0) + sTrim * mmPerScene };
    if (b.slot === endSlot && eTrim > 0) return { ...b, extend: (b.extend ?? 0) - eTrim * mmPerScene };
    return b;
  });
  return { start: nextStart, end: nextEnd, bindings: nextBindings };
}
