/**
 * ADR-363 Phase 1J — «Τοίχος πάνω σε οντότητα 2Δ» geometry bridge (pure SSoT).
 *
 * Γέφυρα ανάμεσα στο hit-test υπάρχουσας 2Δ γεωμετρίας (LINE / POLYLINE /
 * LWPOLYLINE / RECTANGLE) και στους ΥΠΑΡΧΟΝΤΕΣ wall builders. ΚΑΜΙΑ αναπαραγωγή
 * geometry math:
 *   - hit-test μέσω `pointToLineDistance` (ίδιο SSoT με `canvas-click-entity-hit`).
 *   - μέσα/έξω μέσω `isPointInPolygon` (`utils/geometry/GeometryUtils`).
 *   - axis-offset (παρειά στη γραμμή + φούσκωμα προς το side point) μέσω του
 *     `buildDefaultWallParams` alignmentPoint path (Phase 1F `computeWallAlignmentOffset`).
 *   - entity build/validation μέσω `buildWallEntity`.
 *
 * Σημασιολογία (Giorgio 2026-05-30):
 *   - Γραμμή: ένας τοίχος, ίδιο μήκος· η παρειά μακριά από το side point κάθεται
 *     στη γραμμή, ο τοίχος φουσκώνει προς το side point.
 *   - Κλειστό (ορθογώνιο/polyline): 4+ τοίχοι περιμετρικά· side point ΜΕΣΑ → τοίχοι
 *     εσωτερικά (εξωτερική παρειά στο περίγραμμα)· side point ΕΞΩ → εξωτερικά
 *     (εσωτερική παρειά στο περίγραμμα). Γωνιακές ενώσεις προκύπτουν αυτόματα από
 *     το `addWallToScene` (computeWallTrims) στον caller.
 *
 * Περιορισμός: τα RECTANGLE/closed polygons αντιμετωπίζονται axis-aligned ως προς
 * τις κορυφές τους· το side-test βασίζεται στο vertex centroid (σωστό για κυρτά
 * σχήματα — ορθογώνια/τυπικά δωμάτια).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 1J
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import {
  isLineEntity,
  isPolylineEntity,
  isLWPolylineEntity,
  isRectangleEntity,
  isRectEntity,
} from '../../types/entities';
import { pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import type { WallEntity } from '../types/wall-types';
import {
  buildDefaultWallParams,
  buildWallEntity,
  resolveWallThicknessMm,
  type SceneUnits,
  type WallParamOverrides,
} from '../../hooks/drawing/wall-completion';
import { mmToSceneUnits } from '../../utils/scene-units';

// ─── Picked source ───────────────────────────────────────────────────────────

/**
 * Το αποτέλεσμα του 1ου κλικ (διάλεξε οντότητα): είτε μια ευθεία (line / open
 * polyline edge) είτε ένα κλειστό περίγραμμα (rectangle / closed polyline).
 */
export type WallSource =
  | { readonly kind: 'line'; readonly start: Point2D; readonly end: Point2D }
  | { readonly kind: 'closed'; readonly polygon: readonly Point2D[] };

// ─── Hit-test helpers ─────────────────────────────────────────────────────────

/**
 * 4 corners of a rectangle entity. Prefers `x/y/width/height`; falls back to
 * `corner1`/`corner2` (the drawing builder only populates the two click-corners
 * and leaves x/y/width/height undefined — `drawing-entity-builders.ts`). Both
 * paths normalise so right-to-left / bottom-to-top draws still yield a valid CCW
 * outline. Returns `[]` when neither representation is present.
 */
export function rectangleCorners(e: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  corner1?: Point2D;
  corner2?: Point2D;
}): Point2D[] {
  let x: number;
  let y: number;
  let w: number;
  let h: number;
  if (
    typeof e.x === 'number' &&
    typeof e.y === 'number' &&
    typeof e.width === 'number' &&
    typeof e.height === 'number'
  ) {
    x = Math.min(e.x, e.x + e.width);
    y = Math.min(e.y, e.y + e.height);
    w = Math.abs(e.width);
    h = Math.abs(e.height);
  } else if (e.corner1 && e.corner2) {
    x = Math.min(e.corner1.x, e.corner2.x);
    y = Math.min(e.corner1.y, e.corner2.y);
    w = Math.abs(e.corner2.x - e.corner1.x);
    h = Math.abs(e.corner2.y - e.corner1.y);
  } else {
    return [];
  }
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

/** Min distance from `point` to any edge of `poly` (closing edge included when `closed`). */
function polygonMinEdgeDistance(point: Readonly<Point2D>, poly: readonly Point2D[], closed: boolean): number {
  let min = Infinity;
  const n = poly.length;
  if (n < 2) return min;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const d = pointToLineDistance(point, poly[i], poly[(i + 1) % n]);
    if (d < min) min = d;
  }
  return min;
}

/** Nearest open-polyline segment to `point` (returns its endpoints + distance). */
function nearestSegment(
  point: Readonly<Point2D>,
  verts: readonly Point2D[],
): { start: Point2D; end: Point2D; dist: number } | null {
  let best: { start: Point2D; end: Point2D; dist: number } | null = null;
  for (let i = 0; i < verts.length - 1; i++) {
    const d = pointToLineDistance(point, verts[i], verts[i + 1]);
    if (!best || d < best.dist) {
      best = { start: { x: verts[i].x, y: verts[i].y }, end: { x: verts[i + 1].x, y: verts[i + 1].y }, dist: d };
    }
  }
  return best;
}

/**
 * Διάλεξε την πηγή τοίχου κάτω από το κλικ. Επιστρέφει την ΠΛΗΣΙΕΣΤΕΡΗ οντότητα
 * εντός `tolerance` (world units), ή `null` αν δεν βρεθεί τίποτα.
 */
export function pickWallSourceFromEntity(
  point: Readonly<Point2D>,
  entities: readonly Entity[],
  tolerance: number,
): WallSource | null {
  const candidates: { dist: number; source: WallSource }[] = [];
  const consider = (dist: number, source: WallSource): void => {
    if (dist <= tolerance) candidates.push({ dist, source });
  };

  for (const e of entities) {
    if (isLineEntity(e)) {
      consider(pointToLineDistance(point, e.start, e.end), {
        kind: 'line',
        start: { x: e.start.x, y: e.start.y },
        end: { x: e.end.x, y: e.end.y },
      });
      continue;
    }
    if (isRectangleEntity(e) || isRectEntity(e)) {
      const poly = rectangleCorners(e);
      if (poly.length === 4) {
        consider(polygonMinEdgeDistance(point, poly, true), { kind: 'closed', polygon: poly });
      }
      continue;
    }
    if (isPolylineEntity(e) || isLWPolylineEntity(e)) {
      const verts = e.vertices;
      if (!verts || verts.length < 2) continue;
      if (e.closed && verts.length >= 3) {
        consider(polygonMinEdgeDistance(point, verts, true), {
          kind: 'closed',
          polygon: verts.map((v) => ({ x: v.x, y: v.y })),
        });
      } else {
        const seg = nearestSegment(point, verts);
        if (seg) consider(seg.dist, { kind: 'line', start: seg.start, end: seg.end });
      }
    }
  }

  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (b.dist < a.dist ? b : a)).source;
}

// ─── Wall builders (reuse SSoT) ───────────────────────────────────────────────

/**
 * Ένας τοίχος πάνω σε γραμμή. Η παρειά μακριά από `sidePoint` κάθεται στη γραμμή
 * A→B· ο τοίχος φουσκώνει προς το `sidePoint` (Phase 1F alignment semantics).
 * Επιστρέφει `null` αν ο validator απορρίψει (π.χ. μηδενικό μήκος).
 */
export function buildWallForLine(
  start: Readonly<Point2D>,
  end: Readonly<Point2D>,
  sidePoint: Readonly<Point2D>,
  overrides: WallParamOverrides,
  sceneUnits: SceneUnits,
  levelId: string,
): WallEntity | null {
  const params = buildDefaultWallParams(start, end, overrides, sceneUnits, sidePoint);
  const result = buildWallEntity(params, levelId, 'straight', sceneUnits);
  return result.ok ? result.entity : null;
}

/** Vertex-average centroid (true center για ορθογώνιο· interior point για κυρτά). */
function polygonCentroid(poly: readonly Point2D[]): Point2D {
  let sx = 0;
  let sy = 0;
  for (const p of poly) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / poly.length, y: sy / poly.length };
}

/** Drop a duplicated closing vertex (first ≈ last) so each edge is built once. */
function dedupeClosing(poly: readonly Point2D[]): Point2D[] {
  const out = poly.map((p) => ({ x: p.x, y: p.y }));
  if (out.length >= 2) {
    const a = out[0];
    const b = out[out.length - 1];
    if (a.x === b.x && a.y === b.y) out.pop();
  }
  return out;
}

/** Intersection of two infinite lines (point + unit direction). `null` if parallel. */
function intersectLines(
  l1: { px: number; py: number; dx: number; dy: number },
  l2: { px: number; py: number; dx: number; dy: number },
): Point2D | null {
  const denom = l1.dx * l2.dy - l1.dy * l2.dx;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((l2.px - l1.px) * l2.dy - (l2.py - l1.py) * l2.dx) / denom;
  return { x: l1.px + t * l1.dx, y: l1.py + t * l1.dy };
}

/**
 * Περιμετρικοί τοίχοι από κλειστό περίγραμμα. `sidePoint` ΜΕΣΑ → εσωτερικοί τοίχοι
 * (εξωτερική παρειά στο περίγραμμα)· ΕΞΩ → εξωτερικοί (εσωτερική παρειά στο
 * περίγραμμα).
 *
 * Αλγόριθμος (exact miter offset — όχι per-edge alignment): κάθε ακμή μετατοπίζεται
 * παράλληλα κατά halfThickness κατά μήκος της κάθετης προς το centroid (inside) ή
 * αντίθετα (outside)· οι ΑΞΟΝΕΣ των τοίχων είναι οι τομές διαδοχικών offset edge-
 * lines. Έτσι διαδοχικοί τοίχοι μοιράζονται ΑΚΡΙΒΩΣ την ίδια κορυφή → το
 * `computeWallTrims` (στο `addWallToScene`) κλείνει κάθε γωνία με καθαρό miter,
 * για οποιοδήποτε πάχος / γωνία. (Το παλιό per-edge alignment offset άφηνε τους
 * άξονες να μην συναντώνται στις γωνίες → κενά σε χοντρούς τοίχους.)
 *
 * Ένας τοίχος ανά ακμή· validator-rejected ακμές παραλείπονται.
 */
export function buildWallsForClosed(
  polygon: readonly Point2D[],
  sidePoint: Readonly<Point2D>,
  overrides: WallParamOverrides,
  sceneUnits: SceneUnits,
  levelId: string,
): WallEntity[] {
  const verts = dedupeClosing(polygon);
  const n = verts.length;
  if (n < 3) return [];

  const inside = isPointInPolygon(sidePoint as Point2D, verts);
  const centroid = polygonCentroid(verts);
  const halfT = (resolveWallThicknessMm(overrides) / 2) * mmToSceneUnits(sceneUnits);
  // Signed offset along each edge's centroid-ward normal: inside → axis shifts
  // toward centroid (+halfT, outer face stays on the perimeter); outside → away.
  const signed = inside ? halfT : -halfT;

  // Offset line per edge (point on the offset line + unit direction along the edge).
  const lines = verts.map((a, i) => {
    const b = verts[(i + 1) % n];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    let nx = -dy; // left normal
    let ny = dx;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    if ((centroid.x - mx) * nx + (centroid.y - my) * ny < 0) {
      nx = -nx; // flip so the normal points toward the centroid
      ny = -ny;
    }
    return { px: a.x + nx * signed, py: a.y + ny * signed, dx, dy };
  });

  // Axis vertex i = intersection of edge (i-1)'s and edge i's offset lines.
  const axis: Point2D[] = verts.map((v, i) => {
    const p = intersectLines(lines[(i - 1 + n) % n], lines[i]);
    return p ?? { x: v.x, y: v.y };
  });

  const walls: WallEntity[] = [];
  for (let i = 0; i < n; i++) {
    // Wall for edge i runs along its offset line between the two adjacent axis
    // corners — centered axis (no alignment offset), so consecutive walls share
    // axis[i+1] exactly and miter cleanly.
    const params = buildDefaultWallParams(axis[i], axis[(i + 1) % n], overrides, sceneUnits);
    const result = buildWallEntity(params, levelId, 'straight', sceneUnits);
    if (result.ok) walls.push(result.entity);
  }

  return walls;
}
