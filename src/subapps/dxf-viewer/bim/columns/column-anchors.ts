/**
 * ADR-363 Phase 5.5d + Phase 8C — Column anchor world-point exposure (pure SSoT).
 *
 * Industry convention (Revit smart-connect / ArchiCAD beam-to-column auto-snap):
 * όταν ο μηχανικός σύρει beam endpoint κοντά σε υπάρχουσα κολώνα, ο cursor
 * "κουμπώνει" σε ένα από τα anchor points της κολώνας. Αυτό το module εκθέτει
 * τα **9 anchor points** (`center` + `n`/`s`/`e`/`w` + `nw`/`ne`/`sw`/`se`)
 * ενός `ColumnEntity` σε world coordinates ώστε το `EndpointSnapEngine` να τα
 * εισάγει στο spatial index μέσω του `getEntityEndpoints(entity)` SSoT path.
 *
 * Transform pipeline mirrors ακριβώς το `transformFootprint` του
 * `bim/geometry/column-geometry.ts`:
 *
 *   - Rect / L-shape / T-shape / shear-wall / I-shape: ANCHOR_OFFSETS bbox
 *     grid με `dimX = params.width`, `dimY = params.depth`. Local-frame anchor B
 *     = `(dxB·width, dyB·depth)` με `(dxA, dyA) = ANCHOR_OFFSETS[params.anchor]`
 *     shift ώστε ο κλικαρισμένος anchor να συμπίπτει με `position`. Free
 *     rotation γύρω από `position`.
 *   - Circular: anchors ζουν στην περίμετρο. Cardinals σε `radius` (= width/2),
 *     diagonals σε `radius·√2/2` (περίμετρος στα 45°). `params.anchor` και
 *     `params.rotation` αγνοούνται (circular = rotationally symmetric, anchor
 *     πάντα 'center' στο geometry pipeline).
 *   - Polygon (Phase 8C): ANCHOR_OFFSETS bbox grid με `dimX, dimY` υπολογισμένα
 *     από τα N-gon vertices (mirror του geometry pipeline computeLocalBboxCanvas).
 *     Hexagon Ø=400 → dimX=346.4, dimY=400. Anchor offset + rotation εφαρμόζονται
 *     όπως στα rect kinds.
 *
 * Pure module: zero React / DOM / Firestore / canvas deps. Idempotent.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 5.5d + Phase 8C
 * @see bim/geometry/column-geometry.ts (transformFootprint — mirror pattern)
 * @see bim/columns/column-anchor-ghosts.ts (Phase 4.5c.1 ghost preview — sibling SSoT)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnAnchor, ColumnEntity, ColumnParams } from '../types/column-types';
import {
  ANCHOR_CYCLE_ORDER,
  ANCHOR_OFFSETS,
  DEFAULT_POLYGON_SIDES,
  MAX_POLYGON_SIDES,
  MIN_POLYGON_SIDES,
} from '../types/column-types';

const DEG_TO_RAD = Math.PI / 180;
const SQRT2_HALF = Math.SQRT2 / 2;

/**
 * Tagged anchor world point. Consumer (snap engine) typically maps σε plain
 * `Point2D[]` αλλά το tag επιτρέπει downstream debug visualization, hover
 * tooltips ("snapped to column NE anchor") και per-anchor priority weighting
 * σε μελλοντικές phases.
 */
export interface ColumnAnchorWorldPoint {
  readonly anchor: ColumnAnchor;
  readonly point: Point2D;
}

/**
 * Compute όλα τα 9 anchor world points για μια κολώνα. Η σειρά ακολουθεί το
 * `ANCHOR_CYCLE_ORDER` (mirror του Tab cycling στο column-tool — προβλέψιμη
 * iteration για consumers + deterministic test assertions).
 *
 * Πάντα επιστρέφει 9 entries, για κάθε `ColumnKind`. Σε κυκλικές κολώνες ο
 * αλγόριθμος εκθέτει τα 4 cardinals στην περίμετρο + 4 diagonals στα 45°
 * (cos45°·r ≈ 0.707·r) ώστε beam endpoints να μπορούν να κολλάνε στα 8
 * συμμετρικά σημεία του κύκλου, mirror Revit cylindrical column behaviour.
 *
 * Degenerate width / depth ≤ 0 → όλα τα anchors collapse στο `position` (καμία
 * εξαίρεση — validation γίνεται upstream στο `validateColumnParams`).
 */
export function getColumnAnchorWorldPoints(
  column: Readonly<ColumnEntity>,
): readonly ColumnAnchorWorldPoint[] {
  const { params } = column;
  const result: ColumnAnchorWorldPoint[] = [];
  for (const anchor of ANCHOR_CYCLE_ORDER) {
    const local = anchorLocalPoint(anchor, params);
    const point = localToWorld(local, params);
    result.push({ anchor, point });
  }
  return result;
}

// ─── Local-frame anchor positions ────────────────────────────────────────────

/**
 * Anchor position στο local frame (origin = bbox centre για rect/L/T/shear-wall/
 * I-shape + polygon, origin = circle centre για circular). BEFORE anchor-shift
 * + rotation.
 */
function anchorLocalPoint(anchor: ColumnAnchor, params: ColumnParams): Point2D {
  if (params.kind === 'circular') {
    return circularAnchorLocal(anchor, params.width / 2);
  }
  if (params.kind === 'polygon') {
    const { dimX, dimY } = polygonBboxMm(params.width, params.polygon?.sides);
    const { dx, dy } = ANCHOR_OFFSETS[anchor];
    return { x: dx * dimX, y: dy * dimY };
  }
  const { dx, dy } = ANCHOR_OFFSETS[anchor];
  return { x: dx * params.width, y: dy * params.depth };
}

/**
 * Circular anchor local frame: cardinals στην περίμετρο (radius), diagonals
 * στα 45° (radius · √2/2). Mirror του industry-standard "8-clock" snap pattern
 * για κυκλικές κολώνες (Revit + ArchiCAD).
 */
function circularAnchorLocal(anchor: ColumnAnchor, radius: number): Point2D {
  const r = Math.max(0, radius);
  const d = r * SQRT2_HALF;
  switch (anchor) {
    case 'center': return { x: 0, y: 0 };
    case 'n':      return { x: 0, y:  r };
    case 's':      return { x: 0, y: -r };
    case 'e':      return { x:  r, y: 0 };
    case 'w':      return { x: -r, y: 0 };
    case 'ne':     return { x:  d, y:  d };
    case 'nw':     return { x: -d, y:  d };
    case 'se':     return { x:  d, y: -d };
    case 'sw':     return { x: -d, y: -d };
  }
}

// ─── Local → world transform (mirror column-geometry.transformFootprint) ────

/**
 * Mirror του `transformFootprint` (column-geometry.ts): anchor offset shift →
 * rotation γύρω από `position` → translate σε world. Circular bypasses anchor
 * shift + rotation (consistent με τη γεωμετρία — circular footprint είναι
 * rotationally symmetric και πάντα anchored στο 'center'). Polygon χρησιμοποιεί
 * actual bbox dimensions (όχι width × depth, μιας και depth ignored και actual
 * bbox depends on N).
 */
function localToWorld(local: Point2D, params: ColumnParams): Point2D {
  if (params.kind === 'circular') {
    return { x: params.position.x + local.x, y: params.position.y + local.y };
  }
  const { dx, dy } = ANCHOR_OFFSETS[params.anchor];
  let dimX: number;
  let dimY: number;
  if (params.kind === 'polygon') {
    ({ dimX, dimY } = polygonBboxMm(params.width, params.polygon?.sides));
  } else {
    dimX = params.width;
    dimY = params.depth;
  }
  const shiftX = -dx * dimX;
  const shiftY = -dy * dimY;
  const cos = Math.cos(params.rotation * DEG_TO_RAD);
  const sin = Math.sin(params.rotation * DEG_TO_RAD);
  const lx = local.x + shiftX;
  const ly = local.y + shiftY;
  const rx = lx * cos - ly * sin;
  const ry = lx * sin + ly * cos;
  return { x: params.position.x + rx, y: params.position.y + ry };
}

// ─── Polygon bbox SSoT (Phase 8C) ───────────────────────────────────────────

/**
 * Compute axis-aligned bbox dimensions ενός regular N-gon σε mm coords.
 * Mirror του `buildPolygonLocal` (column-geometry.ts) + `computeLocalBboxCanvas`
 * pattern, αλλά εκφρασμένο σε mm (όχι canvas units) ώστε να συμφωνεί με τα
 * mm-scoped anchor positions του παρόντος module.
 *
 * Vertex 0 points up (math +Y) per AutoCAD/Revit polygon default. Sides clamped
 * to [MIN_POLYGON_SIDES, MAX_POLYGON_SIDES] (3..12). Degenerate diameter ≤ 0
 * collapses bbox σε {0, 0} χωρίς exception.
 *
 * Exported ώστε `column-grips.ts` να μπορεί να positions το polygon rotation
 * handle σύμφωνα με actual bbox (όχι meaningless `params.depth`). Single SSoT.
 */
export function polygonBboxMm(
  diameter: number,
  sides?: number,
): { dimX: number; dimY: number } {
  const r = Math.max(0, diameter / 2);
  if (r === 0) return { dimX: 0, dimY: 0 };
  const rawSides = sides ?? DEFAULT_POLYGON_SIDES;
  const n = Math.max(MIN_POLYGON_SIDES, Math.min(MAX_POLYGON_SIDES, Math.round(rawSides)));
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const startAngle = Math.PI / 2;
  const step = (2 * Math.PI) / n;
  for (let i = 0; i < n; i++) {
    const a = startAngle + i * step;
    const x = r * Math.cos(a);
    const y = r * Math.sin(a);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { dimX: maxX - minX, dimY: maxY - minY };
}
