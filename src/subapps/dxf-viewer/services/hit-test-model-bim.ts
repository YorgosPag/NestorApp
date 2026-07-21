/**
 * ADR-587 Φ10 — BIM handlers του `DxfEntityUnion → EntityModel` seam (spatial index).
 *
 * Κάθε BIM entity φτάνει εδώ σε ΕΝΑ από τρία σχήματα:
 *   1. **direct + recompute** — params/geometry στο top level, αλλά το Firestore
 *      persistence ΠΑΡΑΛΕΙΠΕΙ το `geometry` (re-derivable cache). Ένα entity που μόλις
 *      φορτώθηκε φτάνει με `geometry === undefined` → χωρίς recompute ο `BoundsCalculator`
 *      δεν βρίσκει `geometry.bbox` → **εκτός spatial index → σιωπηλά αδύνατο το κλικ**.
 *      Γι' αυτό υπάρχει ο {@link bimWithGeometryRecompute} — ΕΝΑΣ factory, όχι 14 κλώνοι.
 *   2. **direct, χωρίς recompute** — το geometry έρχεται πάντα μαζί (floor-finish κ.λπ.).
 *   3. **wrapped** — ο canvas converter τα τυλίγει (`DxfSlab.slabEntity` κ.λπ.)· πρέπει να
 *      ξετυλιχθούν, αλλιώς το top level δεν έχει geometry/params.
 *
 * @see ./hit-test-entity-model — το registry που τα δρομολογεί
 * @see bim/utils/bim-entity-passthrough — `buildBimEntityModel` (το 4-field passthrough SSoT)
 */

import type { HitTestModelHandler } from './hit-test-model-types';
import { buildBimEntityModel, type BimPassthroughType } from '../bim/utils/bim-entity-passthrough';
import type { EntityModel } from '../rendering/types/Types';
import { computeStairGeometry } from '../bim/geometry/stairs/StairGeometryService';
import { computeColumnGeometry } from '../bim/geometry/column-geometry';
import { computeFoundationGeometry } from '../bim/geometry/foundation-geometry';
import { computeMepFixtureGeometry } from '../bim/mep-fixtures/mep-fixture-geometry';
import { computeElectricalPanelGeometry } from '../bim/electrical-panels/electrical-panel-geometry';
import { computeMepManifoldGeometry } from '../bim/mep-manifolds/mep-manifold-geometry';
import { computeMepRadiatorGeometry } from '../bim/mep-radiators/mep-radiator-geometry';
import { computeMepBoilerGeometry } from '../bim/mep-boilers/mep-boiler-geometry';
import { computeMepWaterHeaterGeometry } from '../bim/mep-water-heaters/mep-water-heater-geometry';
import { computeMepUnderfloorGeometry } from '../bim/mep-underfloor/mep-underfloor-geometry';
import { computeMepSegmentGeometry } from '../bim/geometry/mep-segment-geometry';
import { computeMepFittingGeometry } from '../bim/geometry/mep-fitting-geometry';
import { computeFurnitureGeometry } from '../bim/furniture/furniture-geometry';
import { computeImportedMeshGeometry } from '../bim/entities/imported-mesh/imported-mesh-geometry';
import { computeGenericSolidGeometry } from '../bim/entities/generic-solid/generic-solid-geometry';
import { computeFloorplanSymbolGeometry } from '../bim/floorplan-symbols/floorplan-symbol-geometry';
import { computeRoofGeometry } from '../bim/geometry/roof-geometry';

/**
 * Σχήμα 1 — direct entity ΜΕ geometry-recompute fallback. Το `geometry` είναι
 * re-derivable cache: αν λείπει (Firestore-loaded / auto-derived), το ξαναχτίζουμε από
 * τα `params` μέσω του per-type `compute*Geometry()` SSoT, ώστε το `geometry.bbox` να
 * υπάρχει ΠΑΝΤΑ όταν το entity μπαίνει στο spatial index.
 *
 * ΕΝΑΣ factory αντί για 14 πανομοιότυπα branches (ήταν copy-paste ανά ADR — N.18).
 */
function bimWithGeometryRecompute<TParams, TGeometry>(
  type: BimPassthroughType,
  computeGeometry: (params: TParams) => TGeometry,
): HitTestModelHandler {
  return (entity, base): EntityModel => {
    const e = entity as unknown as { geometry?: TGeometry; params?: TParams };
    const geometry = e.geometry ?? (e.params ? computeGeometry(e.params) : undefined);
    return buildBimEntityModel(type, { ...(entity as object), geometry }, base);
  };
}

/** Σχήμα 2 — direct entity· params + geometry έρχονται πάντα μαζί στο top level. */
function bimDirect(type: BimPassthroughType): HitTestModelHandler {
  return (entity, base): EntityModel => buildBimEntityModel(type, entity, base);
}

/**
 * Σχήμα 3 — wrapped entity: ο `useDxfSceneConversion` το τυλίγει σε `{ ...base, type,
 * <wrapperKey>: <InnerEntity> }`. Ξετυλίγουμε, αλλιώς το top level δεν έχει geometry/params
 * → `BoundsCalculator` → null → το entity χάνει κάθε hover/click (ADR-363 Bug 1).
 */
function bimWrapped(type: BimPassthroughType, wrapperKey: string): HitTestModelHandler {
  return (entity, base): EntityModel =>
    buildBimEntityModel(type, (entity as unknown as Record<string, unknown>)[wrapperKey], base);
}

/**
 * ADR-358 Phase 8 — η σκάλα ταξιδεύει σε ΔΥΟ σχήματα (raw `StairEntity` από το
 * `useSpecialTools.onStairCreated` · `DxfStair` wrapper από το `useDxfSceneConversion`),
 * ΚΑΙ θέλει geometry-recompute (`StairDoc` §G6 — το geometry δεν persist-άρεται).
 * Άρα δεν χωράει σε κανένα από τα τρία generic σχήματα — δικός της handler.
 */
const stairHandler: HitTestModelHandler = (entity, base): EntityModel => {
  type StairLike = Partial<import('../bim/types/stair-types').StairEntity> & {
    stairEntity?: Partial<import('../bim/types/stair-types').StairEntity>;
  };
  const raw = entity as unknown as StairLike;
  const stairData = (raw.params ? raw : raw.stairEntity) ?? raw;
  const geometry = stairData.geometry
    ?? (stairData.params ? computeStairGeometry(stairData.params) : undefined);
  return {
    ...base,
    type: 'stair',
    // Pass-through fields consumed by StairRenderer + grip pipeline.
    kind: stairData.kind,
    params: stairData.params,
    geometry,
    validation: stairData.validation,
  } as unknown as EntityModel;
};

/** Οι BIM handlers, keyed στον τύπο τους. Καταναλώνονται από το registry του seam. */
export const HIT_TEST_MODEL_BIM_HANDLERS = {
  // ── Σχήμα 1: direct + geometry-recompute fallback ──
  // ADR-397 (column), ADR-436 (foundation), ADR-406 (mep-fixture), ADR-408 Φ3
  // (electrical-panel), ADR-408 Φ12 (mep-manifold), ADR-408 Εύρος Β (mep-radiator/boiler/
  // water-heater/underfloor), ADR-408 Φ8/Φ11 (mep-segment/fitting), ADR-410 (furniture),
  // ADR-415 (floorplan-symbol), ADR-417 (roof).
  column: bimWithGeometryRecompute('column', computeColumnGeometry),
  foundation: bimWithGeometryRecompute('foundation', computeFoundationGeometry),
  'mep-fixture': bimWithGeometryRecompute('mep-fixture', computeMepFixtureGeometry),
  'electrical-panel': bimWithGeometryRecompute('electrical-panel', computeElectricalPanelGeometry),
  'mep-manifold': bimWithGeometryRecompute('mep-manifold', computeMepManifoldGeometry),
  'mep-radiator': bimWithGeometryRecompute('mep-radiator', computeMepRadiatorGeometry),
  'mep-boiler': bimWithGeometryRecompute('mep-boiler', computeMepBoilerGeometry),
  'mep-water-heater': bimWithGeometryRecompute('mep-water-heater', computeMepWaterHeaterGeometry),
  'mep-underfloor': bimWithGeometryRecompute('mep-underfloor', computeMepUnderfloorGeometry),
  'mep-segment': bimWithGeometryRecompute('mep-segment', computeMepSegmentGeometry),
  'mep-fitting': bimWithGeometryRecompute('mep-fitting', computeMepFittingGeometry),
  furniture: bimWithGeometryRecompute('furniture', computeFurnitureGeometry),
  // ADR-683 Φ3 — εισαγόμενο πλέγμα: ίδιο σχήμα με το έπιπλο. Το recompute fallback είναι
  // ΚΡΙΣΙΜΟ εδώ: μετά από reload το `geometry` λείπει, και χωρίς αυτό το εισαγόμενο
  // αντικείμενο θα ήταν αόρατο στο spatial index (= άκλικο).
  'imported-mesh': bimWithGeometryRecompute('imported-mesh', computeImportedMeshGeometry),
  // ADR-684 Φ2 — παραμετρικό στερεό: recompute fallback ΚΡΙΣΙΜΟ (μετά reload το geometry
  // λείπει· χωρίς αυτό το στερεό θα ήταν αόρατο στο spatial index = άκλικο).
  'generic-solid': bimWithGeometryRecompute('generic-solid', computeGenericSolidGeometry),
  'floorplan-symbol': bimWithGeometryRecompute('floorplan-symbol', computeFloorplanSymbolGeometry),
  roof: bimWithGeometryRecompute('roof', computeRoofGeometry),

  // ── Σχήμα 2: direct passthrough (ADR-363 Φ1B/5 wall/beam · ADR-419 floor-finish ·
  // ADR-422 L0 thermal-space · ADR-437 space-separator) ──
  wall: bimDirect('wall'),
  beam: bimDirect('beam'),
  'floor-finish': bimDirect('floor-finish'),
  'thermal-space': bimDirect('thermal-space'),
  'space-separator': bimDirect('space-separator'),
  // ADR-587 Φ10 — GAP FIX: το `railing` (ADR-407) και το `wall-covering` (ADR-511) είναι
  // DxfEntityUnion variants ΚΑΙ renderable, αλλά ΔΕΝ είχαν case → έπεφταν στο `default` →
  // το geometry ΞΕΓΥΜΝΩΝΟΤΑΝ → `BoundsCalculator` → null → εκτός spatial index → **μηδέν
  // hover, μηδέν κλικ**. Ίδια ακριβώς ρίζα με το bug της εικόνας (ADR-654), απλώς κανένα
  // test δεν το έδενε. Τώρα το registry είναι ΠΛΗΡΕΣ `Record` → η παράλειψη σπάει στο tsc.
  railing: bimDirect('railing'),
  'wall-covering': bimDirect('wall-covering'),

  // ── Σχήμα 3: wrapped (ADR-363 Bug 1 v2 / Φ3.7) ──
  opening: bimWrapped('opening', 'openingEntity'),
  slab: bimWrapped('slab', 'slabEntity'),
  'slab-opening': bimWrapped('slab-opening', 'slabOpeningEntity'),

  // ── Ειδικό: σκάλα (δύο σχήματα + recompute) ──
  stair: stairHandler,
} as const satisfies Record<string, HitTestModelHandler>;
