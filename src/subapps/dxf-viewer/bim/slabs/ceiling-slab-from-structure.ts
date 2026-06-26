/**
 * ADR-534 — **Auto-πλάκα οροφής: ενιαίο περίγραμμα κτιρίου** (DXF + BIM combined, μονολιθική, flush top).
 *
 * **Ζητούμενο (Giorgio 2026-06-26):** η πλάκα ορίζεται από το **κλειστό περίγραμμα** που σχηματίζουν τα
 * **δοκάρια + κολόνες + τοιχία** — ΚΑΙ από τις **DXF γραμμές** όπου μια πλευρά δεν έχει δομικό μέλος (π.χ.
 * 3 πλευρές δοκάρια + 1 πλευρά DXF τοίχος). **ΕΝΙΑΙΑ** πλάκα· οι **εσωτερικοί** DXF τοίχοι (χωρίσματα
 * δωματίων) + τα **τόξα ανοίγματος πορτών** **διαλύονται** (δεν τεμαχίζουν/δεν παραμορφώνουν την πλάκα).
 *
 * **Μηχανισμός (DXF + BIM):**
 *   1. **DXF faces:** `extractLineSegments` (γραμμές/πολυγραμμές/τόξα) → `findClosedPolygonsFromLines` με
 *      **gap-bridging** (κλείνει ανοίγματα πορτών). Δίνει τα κλειστά χωρία της κάτοψης.
 *   2. **BIM μέλη ως πολύγωνα:** δοκάρια (`computeBeamGeometry.outline`) + κολόνες (`computeColumnGeometry.
 *      footprint`) — κλείνουν πλευρές που δεν έχουν DXF γραμμή + καλύπτονται (μονολιθικά).
 *   3. **`safeUnion`** ΟΛΩΝ → **ενιαίο περίγραμμα κτιρίου** (διαλύονται εσωτερικά χωρίσματα + τόξα). Παίρνουμε
 *      το **outer ring** κάθε union polygon (γεμάτο, αγνοώντας holes) → η πλάκα καλύπτει & τα δομικά μέλη.
 *
 * Έτσι: καθαρό πλαίσιο δοκαριών (χωρίς DXF) → κλείνει· μικτό (δοκάρια + DXF τοίχος) → κλείνει· εσωτερικά
 * χωρίσματα/πόρτες → αγνοούνται by construction (union).
 *
 * **Flush top:** `levelElevation = max(beam.topElevation)`.
 *
 * **DEFER:** υποδιαίρεση σε φατνώματα από **εσωτερικά** δοκάρια/τοιχία (τώρα → ΕΝΙΑΙΑ)· per-bay πάχος·
 * monolithic BOQ net + T-beam beff + soffit step· ceiling finishes.
 *
 * @see ../../systems/auto-area/auto-area-geometry.ts — findClosedPolygonsFromLines (room faces SSoT)
 * @see ../walls/wall-in-region.ts — extractLineSegments · ../walls/region-tolerance.ts — tol SSoT
 * @see ../geometry/shared/safe-polygon-boolean.ts — safeUnion (robust boolean SSoT)
 * @see ../geometry/beam-geometry.ts / column-geometry.ts — member outlines (SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-534-auto-ceiling-slab-per-bay.md
 */

import type { Pair, Polygon, Ring } from 'polygon-clipping';
import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../types/bim-base';
import type { Entity } from '../../types/entities';
import { isBeamEntity, isColumnEntity } from '../../types/entities';
import type { SlabEntity } from '../types/slab-types';
import type { BeamEntity } from '../types/beam-types';
import {
  completeSlabFromPolygonClicks,
  type SlabParamOverrides,
  type SceneUnits,
} from '../../hooks/drawing/slab-completion';
import { extractLineSegments } from '../walls/wall-in-region';
import { findClosedPolygonsFromLines } from '../../systems/auto-area/auto-area-geometry';
import { resolveRegionLoopTolWorld } from '../walls/region-tolerance';
import { safeUnion } from '../geometry/shared/safe-polygon-boolean';
import { computeBeamGeometry } from '../geometry/beam-geometry';
import { computeColumnGeometry } from '../geometry/column-geometry';
import { polygonArea } from '../walls/perimeter-polygon-math';
import { mmToSceneUnits } from '../../utils/scene-units';

export interface BuildCeilingSlabsResult {
  readonly ok: boolean;
  /** `no-bays` = δεν προέκυψε κλειστό περίγραμμα κτιρίου (ανύπαρκτα/ανοιχτά όρια). */
  readonly reason?: 'no-bays';
  /** Οι πλάκες οροφής (`kind='ceiling'`, flush top) — συνήθως 1 ενιαία ανά κτίριο/component. */
  readonly slabs: readonly SlabEntity[];
  /** Περιγράμματα που απορρίφθηκαν (πολύ μικρά / degenerate / slab validator). */
  readonly ignoredCount: number;
}

/** Ελάχιστο εμβαδόν περιγράμματος (mm²) — κόβει εκφυλισμένα/μικροσκοπικά. 0.5 m². */
const MIN_BAY_AREA_MM2 = 0.5e6;
/**
 * Ελάχιστο **υδραυλικό πλάτος** κτιρίου (mm): `2·area/perimeter`. Κόβει **λεπτά** περιγράμματα που είναι
 * απλώς ένα μεμονωμένο δοκάρι/μέλος (πλάτος ~200-400mm) — ένα πραγματικό κτίριο/δωμάτιο είναι >> αυτό.
 */
const MIN_BUILDING_WIDTH_MM = 600;
/**
 * Gap-bridging (HPGAPTOL) σε mm — γεφυρώνει **ευθύγραμμα** ανοίγματα πορτών ώστε να κλείνουν τα DXF χωρία.
 * Μόνο collinear. ~1.5m (πόρτες/περάσματα). Tunable.
 */
const ROOM_GAP_BRIDGE_MM = 1500;

/** Πρόσθεσε τις ακμές ενός κλειστού ring (Point3D[]) ως segments (wrap-around) στο `out`. */
function addRingEdges(verts: readonly Point3D[] | undefined, out: [Point2D, Point2D][]): void {
  if (!verts || verts.length < 3) return;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    out.push([{ x: a.x, y: a.y }, { x: b.x, y: b.y }]);
  }
}

/** Καθάρισε διπλή κλείνουσα κορυφή (polygon-clipping) Ring → Point2D[]. */
function cleanRing(ring: Ring): Point2D[] {
  const pts: Point2D[] = ring.map(([x, y]) => ({ x, y }));
  if (pts.length >= 2) {
    const f = pts[0];
    const l = pts[pts.length - 1];
    if (f.x === l.x && f.y === l.y) pts.pop();
  }
  return pts;
}

/** Περίμετρος κλειστού Point2D ring (wrap-around). */
function ringPerimeter(ring: readonly Point2D[]): number {
  let p = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    p += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return p;
}

/** Flush top = η μέγιστη `topElevation` των δοκαριών (όλα ομοεπίπεδα σε όροφο). `undefined` αν κανένα. */
function flushTopElevation(beams: readonly BeamEntity[]): number | undefined {
  let top = -Infinity;
  for (const b of beams) {
    if (typeof b.params.topElevation === 'number') top = Math.max(top, b.params.topElevation);
  }
  return top > -Infinity ? top : undefined;
}

/**
 * Παράγει την **ενιαία πλάκα οροφής** (ανά building component) από το κλειστό περίγραμμα που σχηματίζουν
 * DXF γραμμές + δομικά μέλη (δοκάρια/κολόνες). Pure (ο caller persist-άρει μέσω command).
 */
export function buildCeilingSlabsFromStructure(
  entities: readonly Entity[],
  overrides: SlabParamOverrides,
  layerId: string,
  sceneUnits: SceneUnits,
): BuildCeilingSlabsResult {
  // 1. ΕΝΑ γράφημα ακμών: DXF γραμμές (κάτοψη) + ΑΚΜΕΣ δομικών μελών (δοκάρια/κολόνες). Έτσι μια πλευρά
  // που κλείνει από DXF τοίχο ΚΑΙ μια που κλείνει από δοκάρι συνδέονται στον ΙΔΙΟ βρόχο (μικτό κτίριο).
  const segments: [Point2D, Point2D][] = extractLineSegments(entities, { tessellateCurves: true }).map(
    (sg) => [sg.start, sg.end] as [Point2D, Point2D],
  );
  const beams = entities.filter(isBeamEntity);
  const columns = entities.filter(isColumnEntity);
  for (const b of beams) {
    try { addRingEdges(computeBeamGeometry(b.params).outline.vertices, segments); }
    catch { /* skip degenerate beam */ }
  }
  for (const c of columns) {
    try { addRingEdges(computeColumnGeometry(c.params).footprint.vertices, segments); }
    catch { /* skip degenerate column */ }
  }

  // 2. Half-edge planar faces (με gap-bridging για ευθύ άνοιγμα πόρτας).
  const mergeTol = resolveRegionLoopTolWorld(sceneUnits);
  const s = mmToSceneUnits(sceneUnits);
  const gapTol = ROOM_GAP_BRIDGE_MM * s;
  const faces = findClosedPolygonsFromLines(segments, mergeTol, gapTol);
  if (faces.length === 0) {
    return { ok: false, reason: 'no-bays', slabs: [], ignoredCount: 0 };
  }

  // 3. Union ΟΛΩΝ των faces → ενιαίο περίγραμμα κτιρίου (διαλύονται εσωτερικά χωρίσματα + τόξα πορτών +
  // οι ακμές δοκαριών/κολόνων· η πλάκα καλύπτει & τα δομικά μέλη — μονολιθικά).
  const polys: Polygon[] = faces
    .filter((f) => f.length >= 3)
    .map((f) => [f.map((p): Pair => [p.x, p.y])] as Polygon);
  const union = safeUnion(polys[0], ...polys.slice(1));

  // 4. Outer ring κάθε union polygon (γεμάτο, αγνοώντας holes) → 1 πλάκα.
  const minAreaScene = MIN_BAY_AREA_MM2 * s * s;
  const levelElevation = overrides.levelElevation ?? flushTopElevation(beams);

  const slabs: SlabEntity[] = [];
  let ignoredCount = 0;
  const minWidthScene = MIN_BUILDING_WIDTH_MM * s;
  for (const poly of union) {
    if (poly.length === 0) continue;
    const pts = cleanRing(poly[0]);
    const areaScene = pts.length >= 3 ? polygonArea(pts) : 0;
    if (pts.length < 3 || areaScene < minAreaScene) { ignoredCount++; continue; }
    // Κόψε λεπτά περιγράμματα (μεμονωμένο δοκάρι/μέλος): υδραυλικό πλάτος < όριο κτιρίου.
    const perim = ringPerimeter(pts);
    if (perim <= 0 || (2 * areaScene) / perim < minWidthScene) { ignoredCount++; continue; }
    const result = completeSlabFromPolygonClicks(
      pts,
      layerId,
      { ...overrides, kind: 'ceiling', ...(levelElevation !== undefined ? { levelElevation } : {}) },
      sceneUnits,
    );
    if (result.ok) slabs.push(result.entity);
    else ignoredCount++;
  }

  if (slabs.length === 0) {
    return { ok: false, reason: 'no-bays', slabs: [], ignoredCount };
  }
  return { ok: true, slabs, ignoredCount };
}
