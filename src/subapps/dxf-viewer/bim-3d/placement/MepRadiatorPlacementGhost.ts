'use client';

/**
 * MepRadiatorPlacementGhost — translucent 3D preview of the heating radiator about to
 * be placed. ADR-408 Εύρος Β #1. Built via the `createPlacementGhostClass` SSoT
 * (ADR-618): the ghost mesh is produced by the SAME path the commit uses
 * (`buildDefaultMepRadiatorParams` → `computeMepRadiatorGeometry` → `radiatorToMesh`)
 * and reads overrides from the SAME `mepRadiatorToolBridgeStore` — so the preview is
 * exactly what the click creates (WYSIWYG). A radiator keeps a fixed warm-red
 * heating-equipment colour. Translucent material + post-FX overlay + non-pickable +
 * disposal live in the shared `PlacementGhostOverlay` SSoT (ADR-537).
 */

import {
  buildMepRadiatorEntity,
  buildDefaultMepRadiatorParams,
} from '../../hooks/drawing/mep-radiator-completion';
import { computeMepRadiatorGeometry } from '../../bim/mep-radiators/mep-radiator-geometry';
import { radiatorToMesh } from '../converters/BimToThreeConverter';
import { mepRadiatorToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-radiator-tool-bridge-store';
import type { MepRadiatorEntity } from '../../bim/types/mep-radiator-types';
import { createPlacementGhostClass } from './create-placement-ghost';

/** Warm-red heating-equipment ghost tint (matches the committed radiator material family). */
export class MepRadiatorPlacementGhost extends createPlacementGhostClass<
  MepRadiatorEntity,
  MepRadiatorEntity['params'],
  NonNullable<ReturnType<typeof mepRadiatorToolBridgeStore.get>>
>({
  color: 0xdc2626,
  layerId: '__ghost-mep-radiator__',
  bridgeStore: mepRadiatorToolBridgeStore,
  buildParams: (scenePoint, handle, units) =>
    buildDefaultMepRadiatorParams(scenePoint, handle ? { ...handle.overrides } : {}, units),
  computeGeometry: (params) => computeMepRadiatorGeometry(params),
  buildEntity: (params, layerId) => buildMepRadiatorEntity(params, layerId),
  toMesh: (entity, floorElevationMm, levelId) => radiatorToMesh(entity, floorElevationMm, levelId),
}) {}
