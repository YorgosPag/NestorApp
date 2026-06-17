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
 * Καλύπτει τα kinds με **ήδη εξαγόμενο, self-contained `docToEntity`** converter.
 * Το registry είναι extensible: ένα νέο kind μπαίνει με 1 `makeLoader(...)` γραμμή
 * μόλις ο converter του γίνει exported. Εξαιρούνται προς το παρόν:
 *   · `opening` — ο converter απαιτεί το host wall entity (cross-doc dependency).
 *   · slab-opening / railing / furniture / floorplan-symbol / electrical-panel /
 *     MEP equipment — οι converters είναι private μέσα στα persistence hooks.
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
import { thermalSpaceDocToEntity } from '../thermal-spaces/thermal-space-firestore-service';
import { spaceSeparatorDocToEntity } from '../space-separators/space-separator-firestore-service';

// Doc types ────────────────────────────────────────────────────────────────────
import type { ColumnDoc } from '../columns/column-firestore-service';
import type { WallDoc } from '../walls/wall-firestore-service';
import type { BeamDoc } from '../beams/beam-firestore-service';
import type { SlabDoc } from '../slabs/slab-firestore-service';
import type { RoofDoc } from '../roofs/roof-firestore-service';
import type { StairDoc } from '../types/stair-types';
import type { FoundationDoc } from '../foundations/foundation-firestore-service';
import type { FloorFinishDoc } from '../floor-finishes/floor-finish-firestore-service';
import type { ThermalSpaceDoc } from '../thermal-spaces/thermal-space-firestore-service';
import type { SpaceSeparatorDoc } from '../space-separators/space-separator-firestore-service';

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
 */
const CROSS_FLOOR_BIM_LOADERS: readonly CrossFloorKindLoader[] = [
  makeLoader<ColumnDoc>('FLOORPLAN_COLUMNS', columnDocToEntity),
  makeLoader<WallDoc>('FLOORPLAN_WALLS', wallDocToEntity),
  makeLoader<BeamDoc>('FLOORPLAN_BEAMS', beamDocToEntity),
  makeLoader<SlabDoc>('FLOORPLAN_SLABS', slabDocToEntity),
  makeLoader<RoofDoc>('FLOORPLAN_ROOFS', roofDocToEntity),
  makeLoader<StairDoc>('FLOORPLAN_STAIRS', stairDocToEntity),
  makeLoader<FoundationDoc>('FLOORPLAN_FOUNDATIONS', foundationDocToEntity),
  makeLoader<FloorFinishDoc>('FLOORPLAN_FLOOR_FINISHES', floorFinishDocToEntity),
  makeLoader<ThermalSpaceDoc>('FLOORPLAN_THERMAL_SPACES', thermalSpaceDocToEntity),
  makeLoader<SpaceSeparatorDoc>('FLOORPLAN_SPACE_SEPARATORS', spaceSeparatorDocToEntity),
];

/**
 * One-shot fetch of every covered BIM kind for ONE floor, returning the merged
 * scene entities. Tenant `companyId` scoping is auto-applied by
 * `firestoreQueryService.getAll`; `projectId` + `floorId`/`floorplanId` come from
 * the resolved persistence scope. A failing kind degrades to `[]` (never rejects
 * the whole load). Returns `[]` for a floor with no persisted BIM.
 */
export async function loadFloorBimEntities(
  scope: ResolvedBimPersistenceScope,
): Promise<readonly Entity[]> {
  const constraints = buildBimScopeConstraints({
    projectId: scope.projectId,
    floorplanId: scope.floorplanId,
    floorId: scope.floorId,
  });
  const perKind = await Promise.all(
    CROSS_FLOOR_BIM_LOADERS.map((load) => load(constraints).catch(() => [] as Entity[])),
  );
  return perKind.flat();
}
