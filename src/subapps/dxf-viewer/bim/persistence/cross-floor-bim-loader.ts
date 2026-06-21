'use client';

/**
 * cross-floor-bim-loader — one-shot per-entity BIM sourcing SSoT for NON-active
 * floors (ADR-469).
 *
 * ΓΙΑΤΙ: Οι all-floors aggregators (`useFloors3DAggregator` 3Δ +
 * `useBuildingFloorScenes` 2Δ) διαβάζουν το BIM **άλλων** ορόφων από το
 * `.scene.json` snapshot (`loadFileV2`). Ένας **file-less** όροφος (καμία κάτοψη
 * DXF — μόνο BIM σε άδειο καμβά) ή ένας **orphaned** όροφος (το `sceneFileId`
 * δείχνει σε διαγραμμένο `files`/`cadFiles` doc) **δεν έχει snapshot** → τα BIM του
 * (π.χ. κολώνες) είναι αόρατα στο «Όλοι οι όροφοι» — ενώ είναι σωστά αποθηκευμένα
 * στα per-entity collections (`floorplan_*`, keyed-by-`floorId`, ADR-420).
 *
 * Αυτό το module γενικεύει το foundation model-SSoT pattern (ADR-459 Φ7 —
 * `useFoundationLevelSync.subscribeFoundations`) σε **όλα** τα structural BIM kinds,
 * αλλά **one-shot** (`firestoreQueryService.getAll`, ΟΧΙ realtime subscription) →
 * μηδέν per-floor subscription explosion· το κόστος το πληρώνει **μόνο** ένας όροφος
 * χωρίς (έγκυρο) snapshot, και το αποτέλεσμα cache-άρεται από τον caller.
 *
 * Καλύπτει **όλα** τα renderable BIM kinds μέσω self-contained `docToEntity`
 * converters (ADR-469 v1.1 — τα structural + slab-opening + railing + furniture +
 * floorplan-symbol + electrical-panel + όλος ο MEP εξοπλισμός). Το registry είναι
 * extensible: ένα νέο kind μπαίνει με 1 `makeLoader(...)` γραμμή μόλις ο converter
 * του γίνει exported (co-located `*-persistence-helpers.ts`).
 *   · `wall` + `opening` = special-case: τα walls φορτώνονται ρητά (`loadFloorWalls`)
 *     και χρησιμεύουν ΚΑΙ ως host lookups για τα openings (`loadFloorOpenings`,
 *     `params.wallId` → host), ώστε να μην γίνεται διπλό `getAll` στα walls.
 *   · `mep-system` — logical network entity, ΟΧΙ scene `Entity` (δεν renderάρεται).
 *
 * @see ./bim-floor-scope.ts — `resolveBimPersistenceScope` / `buildBimScopeConstraints`
 * @see ../../hooks/data/useFloors3DAggregator.ts — 3Δ consumer (fallback)
 * @see ../../hooks/data/useBuildingFloorScenes.ts — 2Δ consumer (fallback)
 * @see docs/centralized-systems/reference/adrs/ADR-469-cross-floor-per-entity-bim-load.md
 */

import type { DocumentData, QueryConstraint } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore';
import type { CollectionKey } from '@/config/firestore-collections';

import { buildBimScopeConstraints, type ResolvedBimPersistenceScope } from './bim-floor-scope';
import type { Entity } from '../../types/entities';

// docToEntity converters (already exported, self-contained) ────────────────────
import { columnDocToEntity } from '../../hooks/data/column-persistence-helpers';
import { docToEntity as wallDocToEntity } from '../../hooks/data/wall-persistence-helpers';
import { beamDocToEntity } from '../../hooks/data/beam-persistence-helpers';
import { docToEntity as slabDocToEntity } from '../../hooks/data/slab-persistence-helpers';
import { docToEntity as roofDocToEntity } from '../../hooks/data/roof-persistence-helpers';
import { stairDocToEntity } from '../stairs/stair-doc-hydration';
import { foundationDocToEntity } from '../foundations/foundation-firestore-service';
import { floorFinishDocToEntity } from '../floor-finishes/floor-finish-firestore-service';
import { hatchDocToEntity } from '../hatch/hatch-firestore-service';
import { thermalSpaceDocToEntity } from '../thermal-spaces/thermal-space-firestore-service';
import { spaceSeparatorDocToEntity } from '../space-separators/space-separator-firestore-service';
import { slabOpeningDocToEntity } from '../../hooks/data/slab-opening-persistence-helpers';
import { railingDocToEntity } from '../../hooks/data/railing-persistence-helpers';
import { furnitureDocToEntity } from '../../hooks/data/furniture-persistence-helpers';
import { floorplanSymbolDocToEntity } from '../../hooks/data/floorplan-symbol-persistence-helpers';
import { electricalPanelDocToEntity } from '../../hooks/data/electrical-panel-persistence-helpers';
import { mepFixtureDocToEntity } from '../../hooks/data/mep-fixture-persistence-helpers';
import { mepSegmentDocToEntity } from '../../hooks/data/mep-segment-persistence-helpers';
import { mepFittingDocToEntity } from '../../hooks/data/mep-fitting-persistence-helpers';
import { mepManifoldDocToEntity } from '../../hooks/data/mep-manifold-persistence-helpers';
import { mepRadiatorDocToEntity } from '../../hooks/data/mep-radiator-persistence-helpers';
import { mepBoilerDocToEntity } from '../../hooks/data/mep-boiler-persistence-helpers';
import { mepWaterHeaterDocToEntity } from '../../hooks/data/mep-water-heater-persistence-helpers';
import { mepUnderfloorDocToEntity } from '../../hooks/data/mep-underfloor-persistence-helpers';
// opening — special-case (host-wall dependency, see loadFloorOpenings below).
import { openingDocToEntity } from '../walls/opening-doc-hydration';

// Doc types ────────────────────────────────────────────────────────────────────
import type { ColumnDoc } from '../columns/column-firestore-service';
import type { WallDoc } from '../walls/wall-firestore-service';
import type { BeamDoc } from '../beams/beam-firestore-service';
import type { SlabDoc } from '../slabs/slab-firestore-service';
import type { RoofDoc } from '../roofs/roof-firestore-service';
import type { StairDoc } from '../types/stair-types';
import type { FoundationDoc } from '../foundations/foundation-firestore-service';
import type { FloorFinishDoc } from '../floor-finishes/floor-finish-firestore-service';
import type { HatchDoc } from '../hatch/hatch-firestore-service';
import type { ThermalSpaceDoc } from '../thermal-spaces/thermal-space-firestore-service';
import type { SpaceSeparatorDoc } from '../space-separators/space-separator-firestore-service';
import type { SlabOpeningDoc } from '../slab-openings/slab-opening-firestore-service';
import type { RailingDoc } from '../railings/railing-firestore-service';
import type { FurnitureDoc } from '../furniture/furniture-firestore-service';
import type { FloorplanSymbolDoc } from '../floorplan-symbols/floorplan-symbol-firestore-service';
import type { ElectricalPanelDoc } from '../electrical-panels/electrical-panel-firestore-service';
import type { MepFixtureDoc } from '../mep-fixtures/mep-fixture-firestore-service';
import type { MepSegmentDoc } from '../mep-segments/mep-segment-firestore-service';
import type { MepFittingDoc } from '../mep-fittings/mep-fitting-firestore-service';
import type { MepManifoldDoc } from '../mep-manifolds/mep-manifold-firestore-service';
import type { MepRadiatorDoc } from '../mep-radiators/mep-radiator-firestore-service';
import type { MepBoilerDoc } from '../mep-boilers/mep-boiler-firestore-service';
import type { MepWaterHeaterDoc } from '../mep-water-heaters/mep-water-heater-firestore-service';
import type { MepUnderfloorDoc } from '../mep-underfloor/mep-underfloor-firestore-service';
import type { OpeningDoc } from '../walls/opening-firestore-service';
import type { WallEntity } from '../types/wall-types';

/** A per-kind one-shot loader: scope constraints → that kind's scene entities. */
type CrossFloorKindLoader = (constraints: QueryConstraint[]) => Promise<Entity[]>;

/**
 * Builds a per-kind one-shot loader: `getAll` the collection under the supplied
 * scope constraints, then map each doc to a scene `Entity` via its converter.
 * A converter that returns `null` (unhydratable doc) is filtered out.
 */
function makeLoader<TDoc extends DocumentData>(
  key: CollectionKey,
  toEntity: (doc: TDoc) => Entity | null,
): CrossFloorKindLoader {
  return async (constraints) => {
    const res = await firestoreQueryService.getAll<TDoc>(key, { constraints });
    const out: Entity[] = [];
    for (const doc of res.documents) {
      const entity = toEntity(doc);
      if (entity) out.push(entity);
    }
    return out;
  };
}

/**
 * Registry of per-kind loaders. Order is cosmetic (results are flattened). Add a
 * kind here once its `docToEntity` converter is exported + self-contained.
 *
 * `wall` is NOT in this registry — it is fetched explicitly by `loadFloorWalls`
 * so the same wall set serves both as scene entities AND as host lookups for the
 * opening loader (avoids a duplicate `getAll` on the walls collection).
 */
const CROSS_FLOOR_BIM_LOADERS: readonly CrossFloorKindLoader[] = [
  makeLoader<ColumnDoc>('FLOORPLAN_COLUMNS', columnDocToEntity),
  makeLoader<BeamDoc>('FLOORPLAN_BEAMS', beamDocToEntity),
  makeLoader<SlabDoc>('FLOORPLAN_SLABS', slabDocToEntity),
  makeLoader<RoofDoc>('FLOORPLAN_ROOFS', roofDocToEntity),
  makeLoader<StairDoc>('FLOORPLAN_STAIRS', stairDocToEntity),
  makeLoader<FoundationDoc>('FLOORPLAN_FOUNDATIONS', foundationDocToEntity),
  makeLoader<FloorFinishDoc>('FLOORPLAN_FLOOR_FINISHES', floorFinishDocToEntity),
  makeLoader<HatchDoc>('FLOORPLAN_HATCHES', hatchDocToEntity),
  makeLoader<ThermalSpaceDoc>('FLOORPLAN_THERMAL_SPACES', thermalSpaceDocToEntity),
  makeLoader<SpaceSeparatorDoc>('FLOORPLAN_SPACE_SEPARATORS', spaceSeparatorDocToEntity),
  makeLoader<SlabOpeningDoc>('FLOORPLAN_SLAB_OPENINGS', slabOpeningDocToEntity),
  makeLoader<RailingDoc>('FLOORPLAN_RAILINGS', railingDocToEntity),
  makeLoader<FurnitureDoc>('FLOORPLAN_FURNITURE', furnitureDocToEntity),
  makeLoader<FloorplanSymbolDoc>('FLOORPLAN_SYMBOLS', floorplanSymbolDocToEntity),
  makeLoader<ElectricalPanelDoc>('FLOORPLAN_ELECTRICAL_PANELS', electricalPanelDocToEntity),
  makeLoader<MepFixtureDoc>('FLOORPLAN_MEP_FIXTURES', mepFixtureDocToEntity),
  makeLoader<MepSegmentDoc>('FLOORPLAN_MEP_SEGMENTS', mepSegmentDocToEntity),
  makeLoader<MepFittingDoc>('FLOORPLAN_MEP_FITTINGS', mepFittingDocToEntity),
  makeLoader<MepManifoldDoc>('FLOORPLAN_MEP_MANIFOLDS', mepManifoldDocToEntity),
  makeLoader<MepRadiatorDoc>('FLOORPLAN_MEP_RADIATORS', mepRadiatorDocToEntity),
  makeLoader<MepBoilerDoc>('FLOORPLAN_MEP_BOILERS', mepBoilerDocToEntity),
  makeLoader<MepWaterHeaterDoc>('FLOORPLAN_MEP_WATER_HEATERS', mepWaterHeaterDocToEntity),
  makeLoader<MepUnderfloorDoc>('FLOORPLAN_MEP_UNDERFLOORS', mepUnderfloorDocToEntity),
];

/**
 * Fetch walls explicitly (not via the registry). Their entities are both scene
 * content AND the host lookup the opening loader needs — one fetch serves both.
 */
async function loadFloorWalls(constraints: QueryConstraint[]): Promise<WallEntity[]> {
  const res = await firestoreQueryService.getAll<WallDoc>('FLOORPLAN_WALLS', { constraints });
  return res.documents.map(wallDocToEntity);
}

/**
 * Fetch openings + hydrate each against its host wall (`params.wallId`). An
 * opening whose host wall is absent hydrates to `null` (converter contract) and
 * is dropped — it re-appears once the host wall is present.
 */
async function loadFloorOpenings(
  constraints: QueryConstraint[],
  walls: readonly WallEntity[],
): Promise<Entity[]> {
  const res = await firestoreQueryService.getAll<OpeningDoc>('FLOORPLAN_OPENINGS', { constraints });
  const wallsById = new Map<string, WallEntity>(walls.map((w) => [w.id, w]));
  const out: Entity[] = [];
  for (const doc of res.documents) {
    const entity = openingDocToEntity(doc, wallsById.get(doc.params.wallId) ?? null);
    if (entity) out.push(entity);
  }
  return out;
}

/**
 * One-shot fetch of every covered BIM kind for ONE floor, returning the merged
 * scene entities. Tenant `companyId` scoping is auto-applied by
 * `firestoreQueryService.getAll`; `projectId` + `floorId`/`floorplanId` come from
 * the resolved persistence scope. A failing kind degrades to `[]` (never rejects
 * the whole load). Returns `[]` for a floor with no persisted BIM.
 *
 * Walls + the registry kinds fan out concurrently; openings await only the walls
 * (their host lookups) while the registry is still in flight, so the host-wall
 * dependency adds no serial round-trip for the unrelated kinds.
 */
export async function loadFloorBimEntities(
  scope: ResolvedBimPersistenceScope,
): Promise<readonly Entity[]> {
  const constraints = buildBimScopeConstraints({
    projectId: scope.projectId,
    floorplanId: scope.floorplanId,
    floorId: scope.floorId,
  });
  const wallsPromise = loadFloorWalls(constraints).catch(() => [] as WallEntity[]);
  const registryPromise = Promise.all(
    CROSS_FLOOR_BIM_LOADERS.map((load) => load(constraints).catch(() => [] as Entity[])),
  );
  const walls = await wallsPromise;
  const [perKind, openings] = await Promise.all([
    registryPromise,
    loadFloorOpenings(constraints, walls).catch(() => [] as Entity[]),
  ]);
  return [...walls, ...perKind.flat(), ...openings];
}
