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
 * **Φ2 (ADR-534):** το ενιαίο περίγραμμα **υποδιαιρείται σε φατνώματα** από τους **άξονες των
 * εσωτερικών δοκαριών** (location lines) + τις **κεντρικές γραμμές τοιχίων** (`subdivideIntoBays`).
 * Κάθε φάτνωμα παίρνει **per-bay πάχος** (EC2 §7.4.2 l/d) μέσω του optional `bayThickness` callback.
 *
 * **DEFER:** monolithic BOQ net + T-beam beff + clip boundary-beam στο χαμηλότερο soffit· ceiling finishes.
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
import { isBeamEntity, isColumnEntity, isWallEntity } from '../../types/entities';
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
import { computeWallGeometry } from '../geometry/wall-geometry';
import { polygonArea } from '../walls/perimeter-polygon-math';
import { mmToSceneUnits } from '../../utils/scene-units';
import { subdivideIntoBays, type CeilingBay } from './ceiling-bay-subdivision';

export interface BuildCeilingSlabsResult {
  readonly ok: boolean;
  /** `no-bays` = δεν προέκυψε κλειστό περίγραμμα κτιρίου (ανύπαρκτα/ανοιχτά όρια). */
  readonly reason?: 'no-bays';
  /** Οι πλάκες οροφής (`kind='ceiling'`, flush top) — μία ανά φάτνωμα (Φ2), κοινή κορυφή. */
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

/** Πρόσθεσε τις ακμές μιας **ανοιχτής** πολυγραμμής (άξονας μέλους) ως segments (χωρίς wrap). */
function addPolylineEdges(verts: readonly Point3D[] | undefined, out: [Point2D, Point2D][]): void {
  if (!verts || verts.length < 2) return;
  for (let i = 0; i < verts.length - 1; i++) {
    const a = verts[i];
    const b = verts[i + 1];
    out.push([{ x: a.x, y: a.y }, { x: b.x, y: b.y }]);
  }
}

/** Μάζεψε τους **κόπτες υποδιαίρεσης** (ADR-534 Φ2): άξονες δοκαριών (location lines) + κεντρικές
 *  γραμμές τοιχίων. DXF γραμμές/τόξα ΔΕΝ μπαίνουν — μόνο δομικά μέλη χωρίζουν φατνώματα. */
function collectBayCutters(entities: readonly Entity[]): [Point2D, Point2D][] {
  const cutters: [Point2D, Point2D][] = [];
  for (const b of entities.filter(isBeamEntity)) {
    try { addPolylineEdges(computeBeamGeometry(b.params).axisPolyline.points, cutters); }
    catch { /* skip degenerate beam */ }
  }
  for (const w of entities.filter(isWallEntity)) {
    try { addPolylineEdges(computeWallGeometry(w.params).axisPolyline.points, cutters); }
    catch { /* skip degenerate wall */ }
  }
  return cutters;
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

/** Per-master-region αποτέλεσμα: οι πλάκες-φατνώματα + πόσα φατνώματα απορρίφθηκαν. */
interface RegionBaysResult { readonly slabs: SlabEntity[]; readonly ignored: number; }

/**
 * Υποδιαίρεσε ΕΝΑ master region (outer ring κτιρίου) σε φατνώματα (ADR-534 Φ2) και φτιάξε
 * μία πλάκα οροφής ανά φάτνωμα, με per-bay πάχος (αν δοθεί `bayThickness`). Κοινή κορυφή
 * (`levelElevation`) → το πάχος επεκτείνεται προς τα κάτω (soffit step στη γραμμή του δοκαριού).
 */
function buildBaySlabsForRegion(
  masterPts: readonly Point2D[],
  cutters: readonly [Point2D, Point2D][],
  ctx: { overrides: SlabParamOverrides; layerId: string; sceneUnits: SceneUnits; mergeTol: number },
  levelElevation: number | undefined,
  bayThickness: ((bay: CeilingBay) => number | undefined) | undefined,
): RegionBaysResult {
  const slabs: SlabEntity[] = [];
  let ignored = 0;
  const bays = subdivideIntoBays(masterPts, cutters, ctx.mergeTol, ctx.sceneUnits);
  for (const bay of bays) {
    const thickness = bayThickness?.(bay);
    const result = completeSlabFromPolygonClicks(
      bay.ring,
      ctx.layerId,
      {
        ...ctx.overrides,
        kind: 'ceiling',
        ...(levelElevation !== undefined ? { levelElevation } : {}),
        ...(thickness !== undefined ? { thickness } : {}),
      },
      ctx.sceneUnits,
    );
    if (result.ok) slabs.push(result.entity);
    else ignored++;
  }
  return { slabs, ignored };
}

/**
 * Βήματα 1-3: ΕΝΑ γράφημα ακμών (DXF γραμμές + ΑΚΜΕΣ δοκαριών/κολόνων) → planar faces (gap-bridging
 * πορτών) → `safeUnion` = **ενιαίο/-α περίγραμμα κτιρίου** (διαλύονται εσωτερικά χωρίσματα + τόξα + οι
 * ακμές μελών· η πλάκα καλύπτει & τα δομικά μέλη — μονολιθικά). `null` αν τίποτα δεν κλείνει.
 */
function buildBuildingOutline(
  entities: readonly Entity[],
  sceneUnits: SceneUnits,
): { union: Polygon[]; mergeTol: number; s: number } | null {
  const segments: [Point2D, Point2D][] = extractLineSegments(entities, { tessellateCurves: true }).map(
    (sg) => [sg.start, sg.end] as [Point2D, Point2D],
  );
  for (const b of entities.filter(isBeamEntity)) {
    try { addRingEdges(computeBeamGeometry(b.params).outline.vertices, segments); }
    catch { /* skip degenerate beam */ }
  }
  for (const c of entities.filter(isColumnEntity)) {
    try { addRingEdges(computeColumnGeometry(c.params).footprint.vertices, segments); }
    catch { /* skip degenerate column */ }
  }
  const mergeTol = resolveRegionLoopTolWorld(sceneUnits);
  const s = mmToSceneUnits(sceneUnits);
  const faces = findClosedPolygonsFromLines(segments, mergeTol, ROOM_GAP_BRIDGE_MM * s);
  if (faces.length === 0) return null;
  const polys: Polygon[] = faces
    .filter((f) => f.length >= 3)
    .map((f) => [f.map((p): Pair => [p.x, p.y])] as Polygon);
  return { union: safeUnion(polys[0], ...polys.slice(1)), mergeTol, s };
}

/**
 * Παράγει τις **πλάκες οροφής ανά φάτνωμα** (ADR-534 Φ2) από το κλειστό περίγραμμα που σχηματίζουν
 * DXF γραμμές + δομικά μέλη: ενιαίο περίγραμμα κτιρίου → υποδιαίρεση από εσωτερικά δοκάρια/τοιχία.
 * Optional `bayThickness` → per-bay πάχος (EC2 l/d)· absent → default πάχος του override (single).
 * Pure (ο caller persist-άρει μέσω command).
 */
export function buildCeilingSlabsFromStructure(
  entities: readonly Entity[],
  overrides: SlabParamOverrides,
  layerId: string,
  sceneUnits: SceneUnits,
  bayThickness?: (bay: CeilingBay) => number | undefined,
): BuildCeilingSlabsResult {
  const outline = buildBuildingOutline(entities, sceneUnits);
  if (!outline) return { ok: false, reason: 'no-bays', slabs: [], ignoredCount: 0 };
  const { union, mergeTol, s } = outline;

  // Outer ring κάθε union polygon = master region κτιρίου → υποδιαίρεση σε φατνώματα (Φ2).
  const minAreaScene = MIN_BAY_AREA_MM2 * s * s;
  const minWidthScene = MIN_BUILDING_WIDTH_MM * s;
  const levelElevation = overrides.levelElevation ?? flushTopElevation(entities.filter(isBeamEntity));
  const cutters = collectBayCutters(entities); // άξονες δοκαριών + κεντρικές γραμμές τοιχίων
  const regionCtx = { overrides, layerId, sceneUnits, mergeTol };

  const slabs: SlabEntity[] = [];
  let ignoredCount = 0;
  for (const poly of union) {
    if (poly.length === 0) continue;
    const pts = cleanRing(poly[0]);
    const areaScene = pts.length >= 3 ? polygonArea(pts) : 0;
    if (pts.length < 3 || areaScene < minAreaScene) { ignoredCount++; continue; }
    // Κόψε λεπτά περιγράμματα (μεμονωμένο δοκάρι/μέλος): υδραυλικό πλάτος < όριο κτιρίου.
    const perim = ringPerimeter(pts);
    if (perim <= 0 || (2 * areaScene) / perim < minWidthScene) { ignoredCount++; continue; }
    const region = buildBaySlabsForRegion(pts, cutters, regionCtx, levelElevation, bayThickness);
    slabs.push(...region.slabs);
    ignoredCount += region.ignored;
  }

  if (slabs.length === 0) {
    return { ok: false, reason: 'no-bays', slabs: [], ignoredCount };
  }
  return { ok: true, slabs, ignoredCount };
}
