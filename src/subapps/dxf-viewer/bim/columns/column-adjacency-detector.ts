/**
 * ADR-363 — Post-Creation Column Adjacency Detection (Γ/Τ/Π → τοιχίο).
 *
 * Καθαρές συναρτήσεις (μηδέν side effects) για το «μετά-τη-δημιουργία» σενάριο:
 * ο χρήστης φτιάχνει 2+ ΞΕΧΩΡΙΣΤΕΣ κολόνες (π.χ. σε διαφορετικά box-select). Αν
 * αγγίζονται και μαζί σχηματίζουν Γ/Τ/Π (ή μακρόστενο ορθογώνιο aspect > 4), τότε
 * στατικά είναι **ΕΝΑ τοιχίο** (Eurocode 8 §5.4.2.4 — σύνθετη στατική λειτουργία,
 * ενιαίο κεντροειδές/ροπές/κέντρο διάτμησης), όχι δύο κολόνες. Το σύστημα δεν
 * μπορεί να το ξέρει εκ των προτέρων → post-creation έλεγχος + προαιρετική
 * συγχώνευση (μέσω toast, βλ. `useColumnAdjacencyNotification`).
 *
 * ΚΑΜΙΑ αναπαραγωγή geometry math — πλήρες SSoT reuse:
 *   - footprint κολώνας: `ColumnEntity.geometry.footprint.vertices` (ήδη WORLD
 *     scene units, με position/anchor/rotation baked-in από `computeColumnGeometry`).
 *   - boolean union γειτονικών: `safeUnion` (polygon-clipping SSoT).
 *   - shape classification: `classifyPerimeter` / `decomposeRectilinear` / `normalize`.
 *   - composite build: `buildColumnsFromPerimeters` (ΕΝΑ ColumnEntity ανά περίμετρο).
 *
 * Tolerance: τα footprints κβαντίζονται σε πλέγμα `tol` ΠΡΙΝ το union ώστε να
 * κλείνουν υπο-tol κενά (ίδια φιλοσοφία με το `polygonKey` quantization του
 * `perimeter-from-faces`) — αλλιώς ένα κενό 0.1mm θα εμπόδιζε τη συγχώνευση.
 *
 * @see ./column-from-faces.ts (buildColumnsFromPerimeters, perimeterColumnKind)
 * @see ../walls/perimeter-polygon-math.ts (classifyPerimeter/decompose/normalize)
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md
 */

import type { Pair } from 'polygon-clipping';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isColumnEntity } from '../../types/entities';
import type { ColumnEntity } from '../types/column-types';
import type { SceneUnits } from '../../utils/scene-units';
import { safeUnion, type ClipGeom } from '../geometry/shared/safe-polygon-boolean';
import {
  classifyPerimeter,
  decomposeRectilinear,
  normalize,
  type PerimeterShape,
} from '../walls/perimeter-polygon-math';
import type { ClosedPerimeter } from '../walls/perimeter-from-faces';
import {
  buildColumnsFromPerimeters,
  perimeterColumnKind,
  perimeterAspectRatio,
  isWallColumnKind,
} from './column-from-faces';

/** Αποτέλεσμα ανίχνευσης ομάδας γειτονικών κολωνών που σχηματίζουν τοιχίο. */
export interface ColumnMergeGroup {
  /** Ids όλων των κολωνών της ομάδας (συμπ. της νέας) — ≥ 2. */
  readonly columnIds: readonly string[];
  /** Κατηγορία σχήματος της ένωσης (L/T/U/composite/rectangle-shear-wall). */
  readonly shape: PerimeterShape;
  /** Αναλογία πλευρών της ένωσης (0 για μη-ορθογωνικά). */
  readonly aspect: number;
}

// ─── footprint helpers ────────────────────────────────────────────────────────

/** Footprint μιας κολώνας ως WORLD `Point2D[]` (≥3 κορυφές), αλλιώς `null`. */
export function columnWorldFootprint(column: ColumnEntity): Point2D[] | null {
  const verts = column.geometry?.footprint?.vertices;
  if (!verts || verts.length < 3) return null;
  return verts.map((v) => ({ x: v.x, y: v.y }));
}

/** Κβάντιση πολυγώνου σε πλέγμα `tol` (κλείνει υπο-tol κενά πριν το union). */
function snapToGrid(poly: readonly Point2D[], tol: number): Point2D[] {
  const q = Math.max(tol, 1e-9);
  return poly.map((p) => ({ x: Math.round(p.x / q) * q, y: Math.round(p.y / q) * q }));
}

/** WORLD polygon → polygon-clipping `ClipGeom` (single outer ring, no holes). */
function toGeom(poly: readonly Point2D[], tol: number): ClipGeom {
  return [snapToGrid(poly, tol).map((p): Pair => [p.x, p.y])];
}

/** polygon-clipping ring → `Point2D[]` χωρίς το διπλό κλείσιμο (first===last). */
function ringToPoints(ring: ReadonlyArray<readonly [number, number]>): Point2D[] {
  const pts = ring.map(([x, y]) => ({ x, y }));
  if (pts.length > 1) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9) pts.pop();
  }
  return pts;
}

/** Δύο footprints αγγίζονται/επικαλύπτονται εντός `tol` (union → 1 component). */
function touches(a: readonly Point2D[], b: readonly Point2D[], tol: number): boolean {
  return safeUnion(toGeom(a, tol), toGeom(b, tol)).length === 1;
}

/** Ένωση N footprints σε ΕΝΑ εξώτατο ring· `null` αν δεν είναι συνεκτικά. */
function unionGroup(polys: ReadonlyArray<readonly Point2D[]>, tol: number): Point2D[] | null {
  if (polys.length === 0) return null;
  const geoms = polys.map((p) => toGeom(p, tol));
  const merged = safeUnion(geoms[0], ...geoms.slice(1));
  if (merged.length !== 1) return null;
  return ringToPoints(merged[0][0]);
}

/** WORLD ring → `ClosedPerimeter` (classify + decompose + normalize, SSoT reuse). */
function makeClosedPerimeter(ring: readonly Point2D[], tol: number): ClosedPerimeter {
  const shape = classifyPerimeter(ring, tol);
  const rects = shape === 'composite' ? [] : decomposeRectilinear(ring, tol);
  return { polygon: normalize(ring, tol), shape, rects };
}

// ─── detection ────────────────────────────────────────────────────────────────

interface FootprintItem {
  readonly id: string;
  readonly column: ColumnEntity;
  readonly poly: Point2D[];
}

/** Κολώνες της σκηνής με έγκυρο footprint, ίδιου ορόφου με την `newColumn`. */
function collectFootprintItems(
  newColumn: ColumnEntity,
  entities: readonly Entity[],
): FootprintItem[] {
  const items: FootprintItem[] = [];
  for (const e of entities) {
    if (!isColumnEntity(e)) continue;
    const column = e as ColumnEntity;
    // Same-storey gate: μόνο αν και τα δύο έχουν ορισμένο floorId και διαφέρουν.
    if (newColumn.floorId && column.floorId && column.floorId !== newColumn.floorId) continue;
    const poly = columnWorldFootprint(column);
    if (poly) items.push({ id: column.id, column, poly });
  }
  return items;
}

/** Flood-fill: η συνεκτική ομάδα footprints που αγγίζονται, ξεκινώντας από `seed`. */
function floodGroup(seed: FootprintItem, items: readonly FootprintItem[], tol: number): FootprintItem[] {
  const visited = new Set<string>([seed.id]);
  const group: FootprintItem[] = [seed];
  const queue: FootprintItem[] = [seed];
  while (queue.length > 0) {
    const cur = queue.pop() as FootprintItem;
    for (const cand of items) {
      if (visited.has(cand.id)) continue;
      if (!touches(cur.poly, cand.poly, tol)) continue;
      visited.add(cand.id);
      group.push(cand);
      queue.push(cand);
    }
  }
  return group;
}

/**
 * Βρίσκει την ομάδα γειτονικών κολωνών (συμπ. της `newColumn`) που μαζί σχηματίζουν
 * **τοιχίο** (Γ/Τ/Π ή μακρόστενο ορθογώνιο aspect > 4). Επιστρέφει `null` όταν:
 *   - δεν αγγίζει καμία άλλη κολώνα (ομάδα < 2), ή
 *   - η ένωση είναι ορθογώνιο aspect ≤ 4 (στατικά κολώνα — καμία ειδοποίηση).
 */
export function findAdjacentColumnMergeGroup(
  newColumn: ColumnEntity,
  entities: readonly Entity[],
  tol: number,
): ColumnMergeGroup | null {
  const items = collectFootprintItems(newColumn, entities);
  const seed = items.find((x) => x.id === newColumn.id);
  if (!seed) return null;

  const group = floodGroup(seed, items, tol);
  if (group.length < 2) return null;

  const ring = unionGroup(group.map((g) => g.poly), tol);
  if (!ring) return null;

  const perimeter = makeClosedPerimeter(ring, tol);
  // Notify μόνο όταν η ένωση είναι στατικά ΤΟΙΧΙΟ (shear-wall/composite/U-shape).
  if (!isWallColumnKind(perimeterColumnKind(perimeter))) return null;

  return {
    columnIds: group.map((g) => g.id),
    shape: perimeter.shape,
    aspect: perimeterAspectRatio(perimeter),
  };
}

/**
 * Χτίζει ΕΝΑ composite `ColumnEntity` από την ένωση των footprints των δοθεισών
 * κολωνών (SSoT `buildColumnsFromPerimeters`). `null` αν δεν είναι συνεκτικά (< 2
 * footprints / αποτυχία union) ή ο validator απορρίψει το αποτέλεσμα.
 */
export function buildCompositeFromColumns(
  columns: readonly ColumnEntity[],
  layerId: string,
  sceneUnits: SceneUnits,
  tol: number,
): ColumnEntity | null {
  const polys = columns
    .map((c) => columnWorldFootprint(c))
    .filter((p): p is Point2D[] => p !== null);
  if (polys.length < 2) return null;

  const ring = unionGroup(polys, tol);
  if (!ring) return null;

  const perimeter = makeClosedPerimeter(ring, tol);
  return buildColumnsFromPerimeters([perimeter], layerId, sceneUnits).columns[0] ?? null;
}
