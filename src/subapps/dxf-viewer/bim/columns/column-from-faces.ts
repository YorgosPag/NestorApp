/**
 * ADR-363 Φάση 3 — «Τοιχίο από περίγραμμα» (Column από faces) geometry bridge.
 *
 * 2ος builder πάνω στο ΙΔΙΟ κοινό SSoT `perimeter-from-faces.ts` (ο 1ος είναι ο
 * «Τοίχος από περίγραμμα»). Παίρνεις τις ΠΑΡΕΙΕΣ ενός δομικού στοιχείου
 * (ορθογώνιο / Γ / Τ / Π / σύνθετο) και βγάζεις **ΕΝΑ `ColumnEntity` (τοιχίο ΟΣ)
 * ανά κλειστή περίμετρο** — ΠΟΤΕ αποσύνθεση σε κομμάτια (Eurocode 8: σύνθετη
 * στατική λειτουργία + boundary elements στις συμβολές).
 *
 * Map `shape → ColumnKind` (σύγκλιση κλάδου ETABS/Revit/Tekla — exact polygon για
 * μη-ορθογωνικά):
 *   - rectangle → `rectangular` (ή `shear-wall` αν aspect ≥ SHEAR_WALL_MIN_ASPECT)
 *                 — ΠΑΡΑΜΕΤΡΙΚΟ (width=longSide, depth=shortSide, rotation=γωνία).
 *   - L / T / composite → `composite` — POLYGON-BACKED (ακριβές πολύγωνο).
 *   - U (Π) → `U-shape` — POLYGON-BACKED (`ushape.polygon`).
 *
 * Σύμβαση polygon-centering (η geometry pipeline το εμπιστεύεται): LOCAL mm,
 * bbox-centered, CCW. `position` = bbox-center world, `anchor` = 'center',
 * `rotation` = 0. Το `transformFootprint` (anchor center → μηδέν shift)
 * ξαναγυρνά ΑΚΡΙΒΩΣ στο αρχικό world polygon (round-trip).
 *
 * ΚΑΜΙΑ αναπαραγωγή geometry math πέρα από το bbox/centering:
 *   - shape analysis + normalized polygon → `perimeterFacesToRects` (SSoT Φ0).
 *   - params + validation + geometry → `completeColumnFromClick` (column-completion).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6
 * @see ../walls/perimeter-from-faces.ts (κοινό SSoT)
 * @see ./wall-from-entity.ts mirror (Τοίχος από περίγραμμα)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { ColumnEntity, ColumnKind } from '../types/column-types';
import { SHEAR_WALL_MIN_ASPECT_RATIO } from '../types/column-types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { perimeterFacesToRects, type ClosedPerimeter } from '../walls/perimeter-from-faces';
import type { DetectedRectangle } from '../walls/wall-in-region';
import {
  completeColumnFromClick,
  type ColumnParamOverrides,
} from '../../hooks/drawing/column-completion';

/** Αποτέλεσμα ανάλυσης μιας επιλογής παρειών → τοιχία + πλήθος αγνοημένων. */
export interface PerimeterColumnsResult {
  readonly columns: ColumnEntity[];
  /** Περιγράμματα που δεν έδωσαν έγκυρο τοιχίο (validator-rejected) → toast. */
  readonly ignored: number;
}

// ─── bbox helpers ─────────────────────────────────────────────────────────────

interface PolyBbox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly cx: number;
  readonly cy: number;
}

/** Axis-aligned bounding box + κέντρο ενός πολυγώνου (world scene units). */
function polygonBbox(poly: readonly Point2D[]): PolyBbox {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

/** World polygon → LOCAL mm (bbox-centered): `(world − center) / s`. */
function polygonToLocalMm(
  poly: readonly Point2D[],
  cx: number,
  cy: number,
  s: number,
): Point2D[] {
  return poly.map((p) => ({ x: (p.x - cx) / s, y: (p.y - cy) / s }));
}

// ─── shape → overrides ────────────────────────────────────────────────────────

interface ColumnPlacement {
  readonly center: Point2D;
  readonly overrides: ColumnParamOverrides;
}

/**
 * Ορθογώνιο → ΠΑΡΑΜΕΤΡΙΚΟ rectangular/shear-wall. `position` = κέντρο rect,
 * `width`=longSide (mm), `depth`=shortSide (mm), `rotation` = γωνία μεγάλης ακμής.
 * aspect ≥ SHEAR_WALL_MIN_ASPECT_RATIO (4) → `shear-wall` (Eurocode 8 §5.4.2.4).
 */
function rectColumnPlacement(rect: DetectedRectangle, s: number): ColumnPlacement {
  const c = rect.polygon;
  const center: Point2D = {
    x: (c[0].x + c[1].x + c[2].x + c[3].x) / 4,
    y: (c[0].y + c[1].y + c[2].y + c[3].y) / 4,
  };
  const e01 = Math.hypot(c[1].x - c[0].x, c[1].y - c[0].y);
  const e12 = Math.hypot(c[2].x - c[1].x, c[2].y - c[1].y);
  const longEdge =
    e01 >= e12
      ? { x: c[1].x - c[0].x, y: c[1].y - c[0].y }
      : { x: c[2].x - c[1].x, y: c[2].y - c[1].y };
  const rotation = (Math.atan2(longEdge.y, longEdge.x) * 180) / Math.PI;
  const aspect = rect.shortSide > 0 ? rect.longSide / rect.shortSide : 0;
  const kind: ColumnKind = aspect >= SHEAR_WALL_MIN_ASPECT_RATIO ? 'shear-wall' : 'rectangular';
  return {
    center,
    overrides: { kind, width: rect.longSide / s, depth: rect.shortSide / s, rotation },
  };
}

/**
 * Γ / Τ / Π / σύνθετο → POLYGON-BACKED (ακριβές πολύγωνο). U (Π) → `U-shape`,
 * όλα τα υπόλοιπα → `composite`. polygon = LOCAL mm bbox-centered, CCW.
 */
function polygonColumnPlacement(perimeter: ClosedPerimeter, s: number): ColumnPlacement {
  const bbox = polygonBbox(perimeter.polygon);
  const localMm = polygonToLocalMm(perimeter.polygon, bbox.cx, bbox.cy, s);
  const center: Point2D = { x: bbox.cx, y: bbox.cy };
  const width = (bbox.maxX - bbox.minX) / s;
  const depth = (bbox.maxY - bbox.minY) / s;
  if (perimeter.shape === 'U') {
    return { center, overrides: { kind: 'U-shape', width, depth, ushape: { polygon: localMm } } };
  }
  return { center, overrides: { kind: 'composite', width, depth, composite: { polygon: localMm } } };
}

/** Ένα τοιχίο από μία κλειστή περίμετρο· `null` αν ο validator το απορρίψει. */
function buildPerimeterColumn(
  perimeter: ClosedPerimeter,
  layerId: string,
  s: number,
  sceneUnits: SceneUnits,
): ColumnEntity | null {
  const placement =
    perimeter.shape === 'rectangle' && perimeter.rects.length > 0
      ? rectColumnPlacement(perimeter.rects[0], s)
      : polygonColumnPlacement(perimeter, s);
  const result = completeColumnFromClick(
    placement.center,
    layerId,
    placement.overrides.kind,
    placement.overrides,
    sceneUnits,
  );
  return result.ok ? result.entity : null;
}

// ─── Orchestrators ────────────────────────────────────────────────────────────

/**
 * Έτοιμα περιγράμματα → τοιχία (ΕΝΑ ColumnEntity ανά περίμετρο). Χρησιμοποιείται
 * όταν ο caller έχει ήδη φιλτράρει τα περιγράμματα (π.χ. click-inside via
 * `isPointInPolygon`). Validator-rejected → `ignored++`.
 */
export function buildColumnsFromPerimeters(
  perimeters: readonly ClosedPerimeter[],
  layerId: string,
  sceneUnits: SceneUnits,
): PerimeterColumnsResult {
  const s = mmToSceneUnits(sceneUnits);
  const columns: ColumnEntity[] = [];
  let ignored = 0;
  for (const perimeter of perimeters) {
    const column = buildPerimeterColumn(perimeter, layerId, s, sceneUnits);
    if (column) columns.push(column);
    else ignored++;
  }
  return { columns, ignored };
}

/**
 * Ανάλυση μιας επιλογής παρειών → τοιχία (ΕΝΑ ColumnEntity ανά περίμετρο) +
 * πλήθος αγνοημένων (validator-rejected → toast). Mirror του
 * `perimeterFacesToRects` consume path των τοίχων, αλλά ΧΩΡΙΣ αποσύνθεση σε σκέλη.
 */
export function perimeterFacesToColumns(
  entities: readonly Entity[],
  tol: number,
  layerId: string,
  sceneUnits: SceneUnits,
): PerimeterColumnsResult {
  const { perimeters } = perimeterFacesToRects(entities, tol);
  return buildColumnsFromPerimeters(perimeters, layerId, sceneUnits);
}
