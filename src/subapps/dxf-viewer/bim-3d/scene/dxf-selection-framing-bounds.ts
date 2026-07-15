/**
 * dxf-selection-framing-bounds — world-space Box3 of the SELECTED raw DXF entities in the 3D
 * viewport, so "Z" / "F" frame a picked polyline / line / circle / arc exactly like a BIM
 * selection (ADR-537 raw-DXF-in-3D + ADR-366 A.6.Q4 selection-aware framing).
 *
 * Raw DXF in 3D is a BATCHED wireframe with NO per-entity Object3D (dxf-wireframe-hit-test.ts) →
 * unlike the BIM path we cannot traverse the scene graph for a `userData.bimId`. Instead we resolve
 * each selected id back to its 2D `DxfEntityUnion` through the SAME scope SSoT the pick uses
 * ({@link findDxfEntityInScope}), take its 2D bbox ({@link getEntityBBox}), and project the corners
 * into 3D world with the SAME projector the wireframe / grips / ghosts use ({@link dxfPlanToWorld})
 * at the entity's floor elevation. One unit factor at the boundary ({@link dxfSceneUnitToMm}), no
 * second projector — so the framing box can never drift from what is actually drawn.
 *
 * Ids that do not resolve to a raw-DXF entity in the active scope (e.g. BIM ids, which live in the
 * universal selection as `dxf-entity` too — handoff §2) yield null and are silently skipped; the
 * BIM half of the selection is framed by `computeBimSelectionUnionBounds` on the caller side.
 */

import * as THREE from 'three';
import { getEntityBBox } from '../../canvas-v2/dxf-canvas/dxf-viewport-culling';
import { dxfSceneUnitToMm } from '../../utils/scene-units';
import { dxfPlanToWorld } from '../viewport/coordinate-transforms';
import { SelectedEntitiesStore } from '../../systems/selection/SelectedEntitiesStore';
import { computeBimSelectionUnionBounds, computeSceneFramingBounds } from './scene-framing-bounds';
import { findDxfEntityInScope } from './dxf-3d-floor-scope';

/**
 * Union world-space Box3 of the given raw-DXF entity ids (from the universal selection), or null
 * when none resolve to a framable entity in the active floor scope. Reads the scope stores through
 * {@link findDxfEntityInScope} at call time (ADR-040 — getState, no subscription).
 */
export function computeDxfSelectionWorldBounds(
  selectedDxfIds: readonly string[],
): THREE.Box3 | null {
  if (selectedDxfIds.length === 0) return null;
  const box = new THREE.Box3(); // starts empty (min +∞, max −∞) → expandByPoint builds the AABB
  let framed = false;
  for (const id of selectedDxfIds) {
    const found = findDxfEntityInScope(id);
    if (!found) continue; // BIM id / off-scope / unknown → not a raw-DXF framing target
    const b = getEntityBBox(found.entity);
    if (
      !Number.isFinite(b.minX) || !Number.isFinite(b.minY) ||
      !Number.isFinite(b.maxX) || !Number.isFinite(b.maxY)
    ) continue; // NaN-safe: a corrupt entity must never poison the shared camera frame (ADR-537)
    const unitToMm = dxfSceneUnitToMm(found.scene); // native DXF units → mm (the projector's input)
    const elevMm = found.floorElevationMm;
    // DXF x→world x, DXF y→world −z (axis-aligned map) → the two opposite plan corners bound the
    // world AABB; Box3.expandByPoint tolerates the −z flip regardless of corner order.
    box.expandByPoint(dxfPlanToWorld(b.minX * unitToMm, b.minY * unitToMm, elevMm));
    box.expandByPoint(dxfPlanToWorld(b.maxX * unitToMm, b.maxY * unitToMm, elevMm));
    framed = true;
  }
  return framed && !box.isEmpty() ? box : null;
}

/**
 * Frame-to-selection bounds (F / Z, ADR-366 A.6.Q4) — union of the BIM selection
 * (`computeBimSelectionUnionBounds`) ∪ the raw-DXF selection (universal `SelectedEntitiesStore`,
 * ADR-537 picks), else scene extents. Null → caller no-ops. Lives here (not in the pure
 * `scene-framing-bounds`) because it reads the DXF selection store at call time (ADR-040 —
 * getState, no subscription). BIM ids in the universal selection resolve to null in the DXF
 * scope and are skipped, so there is no double-counting.
 */
export function computeFrameSelectionBounds(
  bimGroup: THREE.Object3D,
  selectedBimIds: readonly string[],
  dxfBounds: THREE.Box3 | null,
): THREE.Box3 | null {
  const bimSel = computeBimSelectionUnionBounds(bimGroup, selectedBimIds);
  const dxfSel = computeDxfSelectionWorldBounds(SelectedEntitiesStore.getSelectedEntityIds());
  let sel = bimSel;
  if (dxfSel) sel = sel ? sel.union(dxfSel) : dxfSel;
  return sel && !sel.isEmpty() ? sel : computeSceneFramingBounds(bimGroup, dxfBounds);
}
