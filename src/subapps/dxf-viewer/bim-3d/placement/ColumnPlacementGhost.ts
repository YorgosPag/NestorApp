'use client';

/**
 * ColumnPlacementGhost — translucent 3D preview of the column about to be placed.
 * ADR-403 (3D BIM Element Placement). Built via the `createPlacementGhostClass` SSoT
 * (ADR-618): the ghost mesh is produced by the SAME builders the commit path uses
 * (`buildDefaultColumnParams` → `computeColumnGeometry` → `columnToMesh`) and reads
 * kind/anchor/overrides from the SAME `columnToolBridgeStore` the ribbon drives — so
 * the preview is exactly what the click will create (WYSIWYG). Translucent material +
 * post-FX overlay + non-pickable + disposal live in the shared `PlacementGhostOverlay`
 * SSoT (ADR-537).
 */

import * as THREE from 'three';
import {
  buildColumnEntity,
  buildDefaultColumnParams,
} from '../../hooks/drawing/column-completion';
import { computeColumnGeometry } from '../../bim/geometry/column-geometry';
import { columnToMesh } from '../converters/BimToThreeConverter';
import { columnToolBridgeStore } from '../../ui/ribbon/hooks/bridge/column-tool-bridge-store';
import type { ColumnEntity } from '../../bim/types/column-types';
import { createPlacementGhostClass } from './create-placement-ghost';

/** Blue structural ghost tint (matches the committed column material family). */
export class ColumnPlacementGhost extends createPlacementGhostClass<
  ColumnEntity,
  ColumnEntity['params'],
  NonNullable<ReturnType<typeof columnToolBridgeStore.get>>
>({
  color: 0x3b82f6,
  layerId: '__ghost-column__',
  bridgeStore: columnToolBridgeStore,
  buildParams: (scenePoint, handle, units) =>
    buildDefaultColumnParams(
      scenePoint,
      handle?.kind,
      handle ? { ...handle.overrides, kind: handle.kind, anchor: handle.anchor } : {},
      units,
    ),
  computeGeometry: (params) => computeColumnGeometry(params),
  buildEntity: (params, layerId, units) => buildColumnEntity(params, layerId, units),
  toMesh: (entity, floorElevationMm, levelId) => {
    // ADR-449 — columnToMesh returns a Group when σοβάς is present· the ghost never
    // passes walls/finish → always a plain Mesh. Guard the union type.
    const mesh = columnToMesh(entity, floorElevationMm, levelId, 0);
    return mesh instanceof THREE.Mesh ? mesh : null;
  },
}) {}
