/**
 * ADR-668 — SSoT: `SceneModel` → {@link Bim3DEntities} type-partition.
 *
 * Pure module (zero React / zero store / zero WebGL). Extracted verbatim out of
 * `hooks/data/useFloors3DAggregator.ts`, where it was module-private and therefore
 * unreachable by any non-React caller.
 *
 * Two consumers, one implementation:
 *   - `useFloors3DAggregator` — the «Όλοι οι όροφοι» 3Δ stack producer (React).
 *   - `export/core/mesh3d` — the headless OBJ/glTF exporter (ADR-668), which must
 *     build a `BimSceneLayer` per floor WITHOUT a mounted 3D viewport, because the
 *     export dialog also runs from the 2D view.
 *
 * Why this matters: `Bim3DEntities` is a pure type-partition of `scene.entities`,
 * so the only reason the exporter could not reach it was module privacy — not any
 * runtime dependency. Duplicating the filter list instead of sharing it would drift
 * the moment a new BIM entity type is added (and jscpd would flag it — N.18).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-668-mesh3d-export-obj-gltf.md
 */

import { EMPTY_BIM_ENTITIES, type Bim3DEntities } from '../stores/Bim3DEntitiesStore';
import {
  isWallEntity, isColumnEntity, isBeamEntity, isFoundationEntity, isSlabEntity,
  isSlabOpeningEntity, isOpeningEntity, isStairEntity, isMepFixtureEntity,
  isElectricalPanelEntity, isRailingEntity, isFurnitureEntity, isMepSegmentEntity,
  isMepFittingEntity, isMepManifoldEntity, isMepRadiatorEntity, isMepBoilerEntity,
  isMepWaterHeaterEntity, isRoofEntity, isFloorFinishEntity, isMepUnderfloorEntity,
} from '../../types/entities';
import type { SceneModel } from '../../types/scene';

/** Split a persisted scene into the per-category BIM bundle the 3D layer wants. */
export function extractBim3DEntities(scene: SceneModel): Bim3DEntities {
  const e = scene.entities;
  return {
    walls: e.filter(isWallEntity),
    columns: e.filter(isColumnEntity),
    beams: e.filter(isBeamEntity),
    foundations: e.filter(isFoundationEntity),
    slabs: e.filter(isSlabEntity),
    slabOpenings: e.filter(isSlabOpeningEntity),
    openings: e.filter(isOpeningEntity),
    stairs: e.filter(isStairEntity),
    fixtures: e.filter(isMepFixtureEntity),
    panels: e.filter(isElectricalPanelEntity),
    railings: e.filter(isRailingEntity),
    furnitures: e.filter(isFurnitureEntity),
    roofs: e.filter(isRoofEntity),
    floorFinishes: e.filter(isFloorFinishEntity),
    mepSegments: e.filter(isMepSegmentEntity),
    mepFittings: e.filter(isMepFittingEntity),
    manifolds: e.filter(isMepManifoldEntity),
    radiators: e.filter(isMepRadiatorEntity),
    boilers: e.filter(isMepBoilerEntity),
    waterHeaters: e.filter(isMepWaterHeaterEntity),
    underfloors: e.filter(isMepUnderfloorEntity),
  };
}

/**
 * ADR-459 Φ7 / ADR-484 Slice 5 — Revit-canonical foundation rule for a **snapshot**
 * floor (i.e. one resolved from a persisted scene, not from the live active store).
 *
 * Two distinct halves, both load-bearing:
 *   - **Non-foundation floor** → drop any `foundations`. A footing baked into the
 *     wrong blob (legacy shared `sceneFileId`, π.χ. πεδιλοδοκοί στο Ισόγειο) must
 *     not render there.
 *   - **The foundation floor** → `foundations` is **overridden** by the authoritative
 *     model footings (`floorplan_foundations`), because cross-level auto πέδιλα never
 *     exist in the scene snapshot at all. Synthesises an entry when there is no
 *     snapshot but footings do exist.
 *
 * Lifted verbatim from the non-active branch of `useFloors3DAggregator.resolveEntities`
 * so the headless exporter (ADR-668) applies the identical rule instead of a lookalike.
 * The live-active branch stays in the hook: it depends on the "active level IS the
 * foundation level ⟺ foundationLevelId == null" invariant, which is meaningless to an
 * exporter where every floor is a snapshot.
 *
 * @param base               partition from {@link extractBim3DEntities}, or null when the floor has no snapshot
 * @param levelId            the floor being resolved
 * @param foundationLevelId  the authoritative foundation level
 * @param modelFootings      authoritative footings from the model SSoT
 */
export function resolveSnapshotFoundations(
  base: Bim3DEntities | null,
  levelId: string,
  foundationLevelId: string | null,
  modelFootings: Bim3DEntities['foundations'],
): Bim3DEntities | null {
  if (levelId !== foundationLevelId) {
    return base && base.foundations.length > 0 ? { ...base, foundations: [] } : base;
  }
  if (!base && modelFootings.length === 0) return null;
  return { ...(base ?? EMPTY_BIM_ENTITIES), foundations: modelFootings };
}
