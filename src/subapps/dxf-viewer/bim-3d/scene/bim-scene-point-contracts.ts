/**
 * bim-scene-point-contracts — executable registry των ομοιόμορφων point-entity 3D
 * builders (ADR-550 Φ2, auto-wiring).
 *
 * Κάθε point-entity οικογένεια (panel / manifold / radiator / boiler / water-heater /
 * foundation / roof / floor-finish / underfloor / railing / furniture) δηλώνεται ΜΙΑ
 * φορά εδώ. Ο `BimSceneLayer.syncFloorEntities` επαναλαμβάνει αυτό το registry αντί
 * για 11 χειροκίνητες `sync*()` μεθόδους — ΕΝΑ registration → αυτόματο 3D build.
 *
 * Adapter, ΟΧΙ rewrite: κάθε entry καλεί τον υπάρχοντα generic SSoT `syncPointEntities`
 * με τις ΙΔΙΕΣ factory κλήσεις που είχαν οι παλιές μέθοδοι (μηδέν αλλαγή drawing logic).
 *
 * Type-safety: ο `pointContract` registrar συνάγει το element type `T` από τον `select`
 * accessor — ο `toMesh` ελέγχεται έναντι του σωστού entity type (no `any`, no index
 * gymnastics). Το closure-erased `run` επιτρέπει ομοιόμορφη iteration στο μητρώο.
 *
 * SSoT-binding: το coverage test εγγυάται ότι το σύνολο των types εδώ ταυτίζεται με τα
 * `d3Builder: 'point'` του `ENTITY_RENDER_CONTRACTS` — μηδέν drift declaration ↔ execution.
 *
 * @see rendering/contract/entity-render-contract.ts — η δηλωτική αυθεντία
 * @see bim-scene-point-syncs.ts — ο generic loop SSoT
 */
import type * as THREE from 'three';
import {
  syncPointEntities,
  type ResolveEntity,
  type PointMeshFactory,
} from './bim-scene-point-syncs';
import type { SyncContext } from './bim-scene-context';
import type { Bim3DEntities } from '../stores/Bim3DEntitiesStore';
import type { BimCategory } from '../../config/bim-object-styles';
import type { BimRenderableType } from '../../rendering/contract/renderable-entity-type';
import type { Discipline } from '../../bim/discipline/bim-discipline';
import {
  panelToMesh,
  manifoldToMesh,
  radiatorToMesh,
  boilerToMesh,
  waterHeaterToMesh,
  foundationToMesh,
} from '../converters/BimToThreeConverter';
import { railingToMesh } from '../converters/railing-to-three';
import { roofToMesh } from '../converters/roof-to-three';
import { floorFinishToMesh } from '../converters/floor-finish-to-three';
import { underfloorToObject3D } from '../converters/mep-underfloor-to-three';
import { furnitureToObject3D } from '../converters/furniture-to-three';

/** Ελάχιστο σχήμα point entity (όπως απαιτεί ο `syncPointEntities`). */
type PointEntity = { id?: string; layerId?: string; discipline?: Discipline };

/** Ένα entry του point registry — με erased `run` για ομοιόμορφη iteration. */
export interface PointEntityContract {
  /** Ο canonical renderable type (δένεται με το `ENTITY_RENDER_CONTRACTS`). */
  readonly type: BimRenderableType;
  /** Η V/G κατηγορία για τον visibility resolver. */
  readonly category: BimCategory;
  /** Χτίζει + προσθέτει όλα τα meshes αυτής της οικογένειας στο group. */
  run(
    group: THREE.Group,
    entities: Bim3DEntities,
    ctx: SyncContext,
    resolve: ResolveEntity,
  ): void;
}

/**
 * Typed registrar. Το `T` συνάγεται από τον `select` accessor (π.χ. `e => e.panels`
 * → `ElectricalPanelEntity`), άρα ο `toMesh` ελέγχεται έναντι του σωστού type.
 */
function pointContract<T extends PointEntity>(
  type: BimRenderableType,
  category: BimCategory,
  select: (entities: Bim3DEntities) => readonly T[] | undefined,
  toMesh: PointMeshFactory<T>,
): PointEntityContract {
  return {
    type,
    category,
    run: (group, entities, ctx, resolve) =>
      syncPointEntities(group, select(entities), category, ctx, resolve, toMesh),
  };
}

/**
 * Το executable registry. Σειρά = η αρχική σειρά κλήσης στο `syncFloorEntities`
 * (αδιάφορη για opaque depth-sorted meshes, αλλά διατηρείται για ντετερμινισμό).
 */
export const POINT_ENTITY_CONTRACTS: readonly PointEntityContract[] = [
  pointContract('foundation', 'foundation', (e) => e.foundations,
    (f, c, r) => foundationToMesh(f, c.floorElevationMm, c.activeLevelId, r.baseElevation)),
  pointContract('electrical-panel', 'electrical-panel', (e) => e.panels,
    (p, c, r) => panelToMesh(p, c.floorElevationMm, c.activeLevelId, r.baseElevation)),
  pointContract('mep-manifold', 'mep-manifold', (e) => e.manifolds,
    (m, c, r) => manifoldToMesh(m, c.floorElevationMm, c.activeLevelId, r.baseElevation)),
  pointContract('mep-radiator', 'mep-radiator', (e) => e.radiators,
    (rad, c, r) => radiatorToMesh(rad, c.floorElevationMm, c.activeLevelId, r.baseElevation)),
  pointContract('mep-boiler', 'mep-boiler', (e) => e.boilers,
    (b, c, r) => boilerToMesh(b, c.floorElevationMm, c.activeLevelId, r.baseElevation)),
  pointContract('mep-water-heater', 'mep-water-heater', (e) => e.waterHeaters,
    (wh, c, r) => waterHeaterToMesh(wh, c.floorElevationMm, c.activeLevelId, r.baseElevation)),
  pointContract('railing', 'railing', (e) => e.railings,
    (rail, c, r) => railingToMesh(rail, c.floorElevationMm, c.activeLevelId, r.baseElevation)),
  pointContract('roof', 'roof', (e) => e.roofs,
    (roof, c, r) => roofToMesh(roof, c.activeLevelId, r.baseElevation)),
  pointContract('floor-finish', 'floor-finish', (e) => e.floorFinishes,
    (ff, c, r) => floorFinishToMesh(ff, c.floorElevationMm, c.activeLevelId, r.baseElevation)),
  pointContract('mep-underfloor', 'mep-underfloor', (e) => e.underfloors,
    (uf, c, r) => underfloorToObject3D(uf, c.floorElevationMm, c.activeLevelId, r.baseElevation)),
  pointContract('furniture', 'furniture', (e) => e.furnitures,
    (f, c, r) => furnitureToObject3D(f, c.floorElevationMm, c.activeLevelId, r.baseElevation)),
];

/** Οι renderable types του registry (για το coverage test binding). */
export const POINT_CONTRACT_TYPES: readonly BimRenderableType[] =
  POINT_ENTITY_CONTRACTS.map((c) => c.type);
