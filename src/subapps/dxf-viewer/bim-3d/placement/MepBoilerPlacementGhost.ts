'use client';

/**
 * MepBoilerPlacementGhost — translucent 3D preview of the heating boiler (λέβητας)
 * about to be placed. ADR-408 Εύρος Β #2. Built via the `createPlacementGhostClass`
 * SSoT (ADR-618): the ghost mesh is produced by the SAME path the commit uses
 * (`buildDefaultMepBoilerParams` → `computeMepBoilerGeometry` → `boilerToMesh`) and
 * reads overrides from the SAME `mepBoilerToolBridgeStore` — so the preview is exactly
 * what the click creates (WYSIWYG). A boiler keeps a fixed warm-red heating-equipment
 * colour. Translucent material + post-FX overlay + non-pickable + disposal live in the
 * shared `PlacementGhostOverlay` SSoT (ADR-537).
 */

import {
  buildMepBoilerEntity,
  buildDefaultMepBoilerParams,
} from '../../hooks/drawing/mep-boiler-completion';
import { computeMepBoilerGeometry } from '../../bim/mep-boilers/mep-boiler-geometry';
import { boilerToMesh } from '../converters/BimToThreeConverter';
import { mepBoilerToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-boiler-tool-bridge-store';
import type { MepBoilerEntity } from '../../bim/types/mep-boiler-types';
import { createPlacementGhostClass } from './create-placement-ghost';

/** Warm-red heating-equipment ghost tint (matches the committed boiler material family). */
export class MepBoilerPlacementGhost extends createPlacementGhostClass<
  MepBoilerEntity,
  MepBoilerEntity['params'],
  NonNullable<ReturnType<typeof mepBoilerToolBridgeStore.get>>
>({
  color: 0xdc2626,
  layerId: '__ghost-mep-boiler__',
  bridgeStore: mepBoilerToolBridgeStore,
  buildParams: (scenePoint, handle, units) =>
    buildDefaultMepBoilerParams(scenePoint, handle ? { ...handle.overrides } : {}, units),
  computeGeometry: (params) => computeMepBoilerGeometry(params),
  buildEntity: (params, layerId) => buildMepBoilerEntity(params, layerId),
  toMesh: (entity, floorElevationMm, levelId) => boilerToMesh(entity, floorElevationMm, levelId),
}) {}
