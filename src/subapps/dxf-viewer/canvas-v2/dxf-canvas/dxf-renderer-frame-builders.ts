/**
 * Per-frame index builders for `DxfRenderer.render()`.
 *
 * Pure O(n) scene scans that produce the per-frame maps consumed by the
 * specialized leaf renderers (DimensionRenderer, SlabRenderer, WallRenderer).
 * Extracted from `DxfRenderer.ts` to keep the orchestrator under the 500-line
 * Google-SRP limit (Boy-Scout file-size split, no logic change).
 *
 * Architecture: each builder is a pure function over `scene.entities` — no
 * `this`, no React, no store subscriptions. Callers push the result into the
 * relevant composite slot every frame (ADR-040 micro-leaf compliance: the
 * orchestrator drives, the leaves never subscribe).
 */
import type { DxfEntityUnion, DxfSlabOpening, DxfOpening, DxfColumn, DxfWall, DxfBeam } from './dxf-types';
import type { Point2D } from '../../rendering/types/Types';
import type { DimensionEntity } from '../../types/dimension';
import type { DimensionLookup } from '../../systems/dimensions/dim-geometry-builder';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import { isWallHostedOpening, type OpeningEntity } from '../../bim/types/opening-types';
import type { OpeningsByWall } from '../../bim/renderers/WallRenderer';
import type { WallCoveringHost } from '../../bim/wall-coverings/wall-covering-strip-geometry';
import type { SceneUnits } from '../../utils/scene-units';
import { isFinishActive } from '../../bim/finishes/structural-finish-types';
// ADR-449 Slice X2 μέρος Β — το 2Δ τρέφεται από την ΙΔΙΑ merged-silhouette SSoT με το 3Δ.
import { computeStructuralFinishSilhouette } from '../../bim/finishes/structural-finish-scene';
import type { SilhouetteBand } from '../../bim/finishes/structural-finish-silhouette';
// ADR-449 Slice 12 (2Δ) — storey-aware columnExtents, ΙΔΙΟ SSoT lookup με το 3Δ scene pass.
import { buildColumnVerticalExtentLookup } from '../../bim/geometry/column-vertical-profile';
import { useActiveStoreyStore } from '../../systems/levels/active-storey-store';

/**
 * ADR-362 Phase C1 — build the per-frame DimensionLookup map for chained
 * dim resolution (baseline / continued). O(n) scan; only `'dimension'`
 * entities land in the map (typically <100 per scene). Returned closure is
 * O(1) lookup at render time.
 */
export function buildDimensionLookup(entities: readonly DxfEntityUnion[]): DimensionLookup {
  const map = new Map<string, DimensionEntity>();
  for (const e of entities) {
    if (e.type === 'dimension') {
      map.set(e.dimensionEntity.id, e.dimensionEntity);
    }
  }
  return (id: string) => map.get(id);
}

/** ADR-363 Phase 3.7 — build per-frame Map<slabId, SlabOpeningEntity[]> for SlabRenderer cutouts. */
export function buildSlabOpeningsBySlab(entities: readonly DxfEntityUnion[]): Map<string, SlabOpeningEntity[]> {
  const m = new Map<string, SlabOpeningEntity[]>();
  for (const e of entities) {
    if (e.type !== 'slab-opening') continue;
    const so = (e as DxfSlabOpening).slabOpeningEntity;
    const arr = m.get(so.params.slabId) ?? [];
    arr.push(so);
    m.set(so.params.slabId, arr);
  }
  return m;
}

/** ADR-363 Phase 2 (deferred pipeline) — build per-frame Map<wallId, OpeningEntity[]> for WallRenderer boolean cutouts. */
export function buildOpeningsByWall(entities: readonly DxfEntityUnion[]): OpeningsByWall {
  const m = new Map<string, OpeningEntity[]>();
  for (const e of entities) {
    if (e.type !== 'opening') continue;
    const o = (e as DxfOpening).openingEntity;
    // ADR-615 — a self-hosted opening has no host wall to cut, so it joins no bucket.
    if (!isWallHostedOpening(o)) continue;
    const arr = m.get(o.params.wallId) ?? [];
    arr.push(o);
    m.set(o.params.wallId, arr);
  }
  return m;
}

/**
 * ADR-509 §axis-clip — build per-frame λίστα column footprints (plan-space vertices)
 * ώστε ο `WallRenderer` να κόβει τον dashed άξονα στην παρειά της κολώνας (location
 * line σταματά στο σώμα, δεν το διαπερνά). O(n) scan· `Point3D` (x,y,z?) ικανοποιεί
 * δομικά το `Point2D` που καταναλώνει ο clip (μηδέν cast).
 */
export function buildColumnFootprints(entities: readonly DxfEntityUnion[]): ReadonlyArray<readonly Point2D[]> {
  const out: (readonly Point2D[])[] = [];
  for (const e of entities) {
    if (e.type !== 'column') continue;
    const verts = (e as DxfColumn).geometry?.footprint?.vertices;
    if (verts && verts.length >= 3) out.push(verts);
  }
  return out;
}

/**
 * ADR-511 — build per-frame Map<wallId, WallCoveringHost> so `WallCoveringRenderer`
 * can resolve its host wall (O(1)) and compute the live face strip. `DxfWall`
 * structurally satisfies `WallCoveringHost` (id + geometry + params.thickness).
 */
export function buildWallsById(entities: readonly DxfEntityUnion[]): Map<string, WallCoveringHost> {
  const m = new Map<string, WallCoveringHost>();
  for (const e of entities) {
    if (e.type !== 'wall') continue;
    const w = e as DxfWall;
    m.set(w.id, w);
  }
  return m;
}

/**
 * ADR-449 Slice X2 μέρος Β — η ΕΝΙΑΙΑ merged silhouette για το **2Δ** finished outline.
 * Καταναλώνει την **ΙΔΙΑ** SSoT (`computeStructuralFinishSilhouette`) με το 3Δ scene pass
 * (`bim-scene-structural-finish-sync`) → ίδιο merged outline, ίδιες γωνίες (μέσω του κοινού
 * `computeMiteredOuter`), ίδιες συμβολές (junctions εσωτερικά της ένωσης → δεν σχεδιάζονται,
 * μηδέν διπλή γραμμή). Αντικαθιστά το παλιό per-element `buildFinishFacesByColumn/Beam` (που
 * ζωγράφιζε κάθε στοιχείο ανεξάρτητα → ασυνεπείς γωνίες/διπλές γραμμές στις συμβολές).
 *
 * ADR-449 Slice 12 (2Δ completion) — storey-aware `columnExtents`: μια `storey-ceiling`
 * κολώνα με `height` > storey ceiling (π.χ. height 4000, ceiling 3000) έπαιρνε raw 4000
 * (legacy `columnZExtent` fallback) → λάθος band grouping ([3000,4000] κολώνα-μόνο) →
 * αποκλίνον 2Δ outline vs 3Δ. Fix: χτίζουμε το ΙΔΙΟ `ColumnVerticalExtentLookup` με το 3Δ
 * (`buildColumnVerticalExtentLookup`) από το active-storey context + περνάμε το πραγματικό
 * `floorElevationMm`. Χωρίς storey context (π.χ. unit tests) → fallback `0`/`undefined` →
 * legacy `params.height` (μηδέν regression). Attached per-corner soffit clip στο 2Δ = DEFER
 * (resolveHostInput undefined· ο σοβάς storey-ceiling/nominal είναι το reported issue).
 *
 * DxfColumn/DxfBeam/DxfWall ικανοποιούν δομικά τα `SilhouetteColumnSource`/`SilhouetteBeamSource`/
 * `WallFinishObstacle` (μηδέν cast). `null` όταν κανένα στοιχείο δεν έχει ενεργό σοβά
 * (default off → μηδέν κόστος).
 */
export interface StructuralFinishSilhouette2D {
  readonly bands: readonly SilhouetteBand[];
  /** sceneUnits του πρώτου δομικού μέλους — το `drawStructuralFinishOutline` το χρειάζεται για το offset. */
  readonly sceneUnits: SceneUnits;
}

export function buildStructuralFinishSilhouette2D(
  entities: readonly DxfEntityUnion[],
): StructuralFinishSilhouette2D | null {
  const columns: DxfColumn[] = [];
  const beams: DxfBeam[] = [];
  for (const e of entities) {
    if (e.type === 'column' && isFinishActive(e.params.finish)) columns.push(e);
    else if (e.type === 'beam' && isFinishActive(e.params.finish)) beams.push(e);
  }
  const walls = entities.filter((w): w is DxfWall => w.type === 'wall');
  // ADR-449 Slice X3 — ο τοίχος είναι finish-member (όχι μόνο obstacle): ένας μεμονωμένος
  // τοίχος (χωρίς κολόνες/δοκάρια) παράγει σοβά → ΜΗΝ κάνεις early-return όσο υπάρχουν τοίχοι.
  // Η `computeStructuralFinishSilhouette` φιλτράρει εσωτερικά τους core-only parapet/fence →
  // bands=[] → null παρακάτω (γραμμή `bands.length === 0`) αν κανένα στοιχείο δεν έχει σοβά.
  if (columns.length === 0 && beams.length === 0 && walls.length === 0) return null;
  // ADR-449 Slice 12 — storey-aware columnExtents (ΙΔΙΟ SSoT lookup με το 3Δ). Το
  // active-storey context είναι zero-React store → ασφαλές read από τον DxfRenderer.
  const storey = useActiveStoreyStore.getState().context;
  const floorElevationMm = storey?.floorElevationMm ?? 0;
  const columnExtents = buildColumnVerticalExtentLookup(columns, {
    floorElevationMm,
    nextFloorElevationMm: storey?.nextFloorElevationMm ?? undefined,
  });
  // ADR-449/458 — 2Δ κάτοψη: `dropPlanHiddenFaces=true` → κρύβει τις junction-όψεις που η
  // plan-προβολή σκεπάζει (π.χ. όψη κολόνας κάτω από δοκάρι) → καθαρό συνεπές outline (miter),
  // χωρίς τις λοξές γραμμούλες της επικαλυπτόμενης z-band στη συμβολή κολόνας↔δοκαριού.
  //
  // ADR-449 §opening-bands — ο σοβάς σέβεται τα κουφώματα (δεν τα σκεπάζει). **ΤΟ ΙΔΙΟ**
  // `buildOpeningsByWall` που τρέφει τα cutouts του 2Δ πυρήνα (`WallRenderer`) → σοβάς και μπετόν
  // κόβονται στο ίδιο κενό εξ ορισμού (+ ADR-615 self-hosted guard δωρεάν). `beamTopClipById`
  // undefined = ως πριν (το vertical clip δεν αφορά κάτοψη).
  const bands = computeStructuralFinishSilhouette(
    columns, beams, walls, floorElevationMm, columnExtents, true, undefined, buildOpeningsByWall(entities),
  );
  if (bands.length === 0) return null;
  const sceneUnits = columns[0]?.params.sceneUnits ?? beams[0]?.params.sceneUnits ?? walls[0]?.params.sceneUnits ?? 'mm';
  return { bands, sceneUnits };
}

// ADR-449 Slice X2 μέρος Β — οι παλιοί per-element 2Δ builders (`buildFinishFacesByColumn/Beam`)
// αφαιρέθηκαν: η ΕΝΙΑΙΑ silhouette (`buildStructuralFinishSilhouette2D` παραπάνω) τους αντικαθιστά.
// BOQ + 3Δ per-element paths (`computeColumnFinishContribution`, ghosts) ΑΜΕΤΑΒΛΗΤΑ.

/** DXF transparency (0..90) → canvas alpha (0..1). 0 transparency = fully opaque. */
export function transparencyToAlpha(transparency: number | undefined): number {
  if (typeof transparency !== 'number' || !Number.isFinite(transparency)) return 1;
  const clamped = Math.max(0, Math.min(90, transparency));
  return 1 - clamped / 100;
}
