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
import type { DxfEntityUnion, DxfSlabOpening, DxfOpening, DxfColumn, DxfWall, DxfBeam, DxfSlab } from './dxf-types';
import type { Point2D } from '../../rendering/types/Types';
import type { DimensionEntity } from '../../types/dimension';
import type { DimensionLookup } from '../../systems/dimensions/dim-geometry-builder';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import { isWallHostedOpening, type OpeningEntity } from '../../bim/types/opening-types';
import type { OpeningsByWall } from '../../bim/renderers/WallRenderer';
// ADR-362 — Bounds → {width,height} SSoT for the per-frame dimension span (readability clamp).
import { getBoundsDimensions } from '../../utils/bounds-utils';
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
 * ΤΑ ΠΕΝΤΕ ΕΥΡΕΤΗΡΙΑ ΚΑΡΕ ΩΣ ΕΝΑ ΑΝΤΙΚΕΙΜΕΝΟ (ADR-743 Φ0).
 *
 * Ένα όνομα για «ό,τι χρειάζεται ο `DxfRenderer.render` πριν αγγίξει έστω μία οντότητα».
 */
export interface FrameIndices {
  readonly dimensionLookup: DimensionLookup;
  readonly slabOpeningsBySlab: Map<string, SlabOpeningEntity[]>;
  readonly openingsByWall: OpeningsByWall;
  readonly wallsById: Map<string, WallCoveringHost>;
  readonly columnFootprints: ReadonlyArray<readonly Point2D[]>;
}

/** Προσθέτει `value` στον κάδο `key` — ο κοινός πυρήνας των δύο group-by ευρετηρίων. */
function pushInto<T>(map: Map<string, T[]>, key: string, value: T): void {
  const bucket = map.get(key);
  if (bucket) bucket.push(value);
  else map.set(key, [value]);
}

/**
 * Χτίζει **και τα πέντε** ευρετήρια καρέ σε **ΕΝΑ** πέρασμα των οντοτήτων (ADR-743 Φ0).
 *
 * ## Γιατί υπάρχει
 *
 * Ο `DxfRenderer.render` καλούσε πέντε ξεχωριστούς builders, καθέναν με **δικό του πλήρη O(n)
 * βρόχο**, ΠΡΙΝ από οποιοδήποτε viewport culling — δηλαδή **πέντε πλήρεις σαρώσεις της σκηνής σε
 * κάθε re-raster**, ανεξάρτητα από το πόσες οντότητες είναι τελικά ορατές. Οι πέντε τύποι που
 * φιλτράρουν είναι **ξένοι μεταξύ τους** (`dimension` / `slab-opening` / `opening` / `column` /
 * `wall`), άρα ένα `switch` σε ένα πέρασμα παράγει **ακριβώς** τα ίδια αποτελέσματα — αυτό είναι
 * το συμβόλαιο που κλειδώνει το `dxf-renderer-frame-indices.test.ts`.
 *
 * 🔴 **Και είναι Η ΡΑΦΗ ΤΟΥ MEMOIZATION.** Και τα πέντε ευρετήρια είναι **καθαρές συναρτήσεις του
 * `entities`** — δεν εξαρτώνται από transform ούτε από viewport. Άρα σε ένα pan/zoom, όπου η
 * σκηνή δεν άλλαξε ούτε κατά μία οντότητα, ξαναχτίζονται **πανομοιότυπα** δεκάδες φορές. Το ίδιο
 * ακριβώς σχήμα που το ADR-735 βρήκε στα ευρετήρια snap (4 μηχανές, 2.504ms → 2,7ms). Αν η
 * μέτρηση της Φ0 δείξει το `raster:indices` κυρίαρχο, η θεραπεία μπαίνει **εδώ** και μόνο εδώ —
 * χωρίς να ξαναγγίξει κανείς τον `DxfRenderer`.
 *
 * ⚠️ Παραμένει **καθαρή** (χωρίς `withPerf`): τη χρονομετρεί ο καλών. Έτσι το module μένει
 * DOM-free/store-free και τεστάρεται χωρίς όργανο.
 */
export function buildFrameIndices(entities: readonly DxfEntityUnion[]): FrameIndices {
  const dimensions = new Map<string, DimensionEntity>();
  const slabOpeningsBySlab = new Map<string, SlabOpeningEntity[]>();
  const openingsByWall: Map<string, OpeningEntity[]> = new Map();
  const wallsById = new Map<string, WallCoveringHost>();
  const columnFootprints: (readonly Point2D[])[] = [];

  for (const e of entities) {
    switch (e.type) {
      case 'dimension':
        dimensions.set(e.dimensionEntity.id, e.dimensionEntity);
        break;
      case 'slab-opening': {
        const so = (e as DxfSlabOpening).slabOpeningEntity;
        pushInto(slabOpeningsBySlab, so.params.slabId, so);
        break;
      }
      case 'opening': {
        const o = (e as DxfOpening).openingEntity;
        // ADR-615 — a self-hosted opening has no host wall to cut, so it joins no bucket.
        if (isWallHostedOpening(o)) pushInto(openingsByWall, o.params.wallId, o);
        break;
      }
      case 'column': {
        const verts = (e as DxfColumn).geometry?.footprint?.vertices;
        if (verts && verts.length >= 3) columnFootprints.push(verts);
        break;
      }
      case 'wall':
        wallsById.set(e.id, e as DxfWall);
        break;
    }
  }

  return {
    dimensionLookup: (id: string) => dimensions.get(id),
    slabOpeningsBySlab,
    openingsByWall,
    wallsById,
    columnFootprints,
  };
}

/**
 * ADR-362 Phase C1 — build the per-frame DimensionLookup map for chained
 * dim resolution (baseline / continued). O(n) scan; only `'dimension'`
 * entities land in the map (typically <100 per scene). Returned closure is
 * O(1) lookup at render time.
 *
 * ⚠️ ADR-743 — ο `DxfRenderer` **δεν** καλεί πια αυτόν (ούτε τους τέσσερις αδελφούς του) ξεχωριστά:
 * περνά από το {@link buildFrameIndices}. Μένουν εξαγόμενοι για τους ΑΛΛΟΥΣ καταναλωτές
 * (`buildStructuralFinishSilhouette2D`) και ως το αναφορικό συμβόλαιο του ισοδυναμίας-test.
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
  // ADR-534 Φ6c — η πλάκα ως finish-member ΚΑΙ στην 2Δ κάτοψη/DXF export (parity με το 3Δ sync):
  // η κατακόρυφη περιμετρική «φάσα» πρέπει να φαίνεται και στα δύο. Ο DxfSlab κρατά το BIM entity
  // στο `.slabEntity` (το `.params` του ικανοποιεί το `SlabFinishMemberSource`, «δύο shapes» ADR-659).
  // Tilted/legacy → η `computeStructuralFinishSilhouette` τα φιλτράρει εσωτερικά (slabIsFinishMember).
  const slabs = entities.filter((e): e is DxfSlab => e.type === 'slab').map((e) => e.slabEntity);
  // ADR-449 Slice X3 — ο τοίχος είναι finish-member (όχι μόνο obstacle): ένας μεμονωμένος
  // τοίχος (χωρίς κολόνες/δοκάρια) παράγει σοβά → ΜΗΝ κάνεις early-return όσο υπάρχουν τοίχοι.
  // ADR-534 Φ6c — ομοίως ένας μεμονωμένος όροφος-δώμα (μόνο πλάκα) παράγει φάσα → κράτα slabs στο guard.
  // Η `computeStructuralFinishSilhouette` φιλτράρει εσωτερικά τους core-only parapet/fence →
  // bands=[] → null παρακάτω (γραμμή `bands.length === 0`) αν κανένα στοιχείο δεν έχει σοβά.
  if (columns.length === 0 && beams.length === 0 && walls.length === 0 && slabs.length === 0) return null;
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
  const bands = computeStructuralFinishSilhouette({
    columns, beams, walls, floorElevationMm, columnExtents,
    dropPlanHiddenFaces: true,
    openingsByWallId: buildOpeningsByWall(entities),
    slabs,
  });
  if (bands.length === 0) return null;
  const sceneUnits = columns[0]?.params.sceneUnits ?? beams[0]?.params.sceneUnits ?? walls[0]?.params.sceneUnits ?? slabs[0]?.params.sceneUnits ?? 'mm';
  return { bands, sceneUnits };
}

// ADR-449 Slice X2 μέρος Β — οι παλιοί per-element 2Δ builders (`buildFinishFacesByColumn/Beam`)
// αφαιρέθηκαν: η ΕΝΙΑΙΑ silhouette (`buildStructuralFinishSilhouette2D` παραπάνω) τους αντικαθιστά.
// BOQ + 3Δ per-element paths (`computeColumnFinishContribution`, ghosts) ΑΜΕΤΑΒΛΗΤΑ.

/** DXF transparency (0..90) → canvas alpha (0..1). 0 transparency = fully opaque. */
/**
 * ADR-362 — the scene's longest span (scene units), published each frame so the dimension
 * renderer can clamp a mismatched imported `DIMSCALE` (the "giant dimension cross" on
 * units-mismatched DXFs).
 *
 * Returns 0 when bounds are absent or non-finite ⇒ the clamp is disabled, which is the
 * safe default (an un-clamped dimension is wrong-looking; a clamp driven by NaN is worse).
 */
export function computeSceneDimensionSpan(
  bounds: { min: Point2D; max: Point2D } | null | undefined,
): number {
  if (!bounds) return 0;
  const { width, height } = getBoundsDimensions(bounds);
  const span = Math.max(width, height);
  return Number.isFinite(span) ? span : 0;
}

export function transparencyToAlpha(transparency: number | undefined): number {
  if (typeof transparency !== 'number' || !Number.isFinite(transparency)) return 1;
  const clamped = Math.max(0, Math.min(90, transparency));
  return 1 - clamped / 100;
}
