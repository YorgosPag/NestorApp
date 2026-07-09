'use client';

/**
 * MepWaterHeaterPlacementGhost — translucent 3D preview of the domestic hot water
 * heater (θερμοσίφωνας) about to be placed. ADR-408 DHW. Built via the
 * `createPlacementGhostClass` SSoT (ADR-618): the ghost mesh is produced by the SAME
 * path the commit uses (`buildDefaultMepWaterHeaterParams` →
 * `computeMepWaterHeaterGeometry` → `waterHeaterToMesh`) and reads overrides from the
 * SAME `mepWaterHeaterToolBridgeStore` — so the preview is exactly what the click
 * creates (WYSIWYG). A water heater keeps a fixed blue DHW-equipment colour.
 * Translucent material + post-FX overlay + non-pickable + disposal live in the shared
 * `PlacementGhostOverlay` SSoT (ADR-537).
 */

import {
  buildMepWaterHeaterEntity,
  buildDefaultMepWaterHeaterParams,
} from '../../hooks/drawing/mep-water-heater-completion';
import { computeMepWaterHeaterGeometry } from '../../bim/mep-water-heaters/mep-water-heater-geometry';
import { waterHeaterToMesh } from '../converters/BimToThreeConverter';
import { mepWaterHeaterToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-water-heater-tool-bridge-store';
import type { MepWaterHeaterEntity } from '../../bim/types/mep-water-heater-types';
import { createPlacementGhostClass } from './create-placement-ghost';

/** Blue DHW-equipment ghost tint (matches the committed water heater material family). */
export class MepWaterHeaterPlacementGhost extends createPlacementGhostClass<
  MepWaterHeaterEntity,
  MepWaterHeaterEntity['params'],
  NonNullable<ReturnType<typeof mepWaterHeaterToolBridgeStore.get>>
>({
  color: 0x2563eb,
  layerId: '__ghost-mep-water-heater__',
  bridgeStore: mepWaterHeaterToolBridgeStore,
  buildParams: (scenePoint, handle, units) =>
    buildDefaultMepWaterHeaterParams(scenePoint, handle ? { ...handle.overrides } : {}, units),
  computeGeometry: (params) => computeMepWaterHeaterGeometry(params),
  buildEntity: (params, layerId) => buildMepWaterHeaterEntity(params, layerId),
  toMesh: (entity, floorElevationMm, levelId) => waterHeaterToMesh(entity, floorElevationMm, levelId),
}) {}
