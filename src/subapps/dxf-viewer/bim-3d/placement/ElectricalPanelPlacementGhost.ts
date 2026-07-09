'use client';

/**
 * ElectricalPanelPlacementGhost — translucent 3D preview of the panel about to be
 * placed. ADR-408 Φ3. Built via the `createPlacementGhostClass` SSoT (ADR-618): the
 * ghost mesh is produced by the SAME path the commit uses
 * (`buildDefaultElectricalPanelParams` → `computeElectricalPanelGeometry` →
 * `panelToMesh`) and reads overrides from the SAME `electricalPanelToolBridgeStore` —
 * so the preview is exactly what the click creates (WYSIWYG). Translucent material +
 * post-FX overlay + non-pickable + disposal live in the shared `PlacementGhostOverlay`
 * SSoT (ADR-537).
 */

import {
  buildElectricalPanelEntity,
  buildDefaultElectricalPanelParams,
} from '../../hooks/drawing/electrical-panel-completion';
import { computeElectricalPanelGeometry } from '../../bim/electrical-panels/electrical-panel-geometry';
import { panelToMesh } from '../converters/BimToThreeConverter';
import { electricalPanelToolBridgeStore } from '../../ui/ribbon/hooks/bridge/electrical-panel-tool-bridge-store';
import type { ElectricalPanelEntity } from '../../bim/types/electrical-panel-types';
import { createPlacementGhostClass } from './create-placement-ghost';

/** Teal electrical-equipment ghost tint (matches the committed panel material family). */
export class ElectricalPanelPlacementGhost extends createPlacementGhostClass<
  ElectricalPanelEntity,
  ElectricalPanelEntity['params'],
  NonNullable<ReturnType<typeof electricalPanelToolBridgeStore.get>>
>({
  color: 0x14b8a6,
  layerId: '__ghost-electrical-panel__',
  bridgeStore: electricalPanelToolBridgeStore,
  buildParams: (scenePoint, handle, units) =>
    buildDefaultElectricalPanelParams(scenePoint, handle ? { ...handle.overrides } : {}, units),
  computeGeometry: (params) => computeElectricalPanelGeometry(params),
  buildEntity: (params, layerId) => buildElectricalPanelEntity(params, layerId),
  toMesh: (entity, floorElevationMm, levelId) => panelToMesh(entity, floorElevationMm, levelId),
}) {}
