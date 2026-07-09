'use client';

/**
 * MepFixturePlacementGhost — translucent 3D preview of the fixture about to be placed.
 * ADR-406. Built via the `createPlacementGhostClass` SSoT (ADR-618): the ghost mesh is
 * produced by the SAME path the commit uses (`buildDefaultMepFixtureParams` →
 * `computeMepFixtureGeometry` → `fixtureToMesh`) and reads shape/overrides from the
 * SAME `mepFixtureToolBridgeStore` — so the preview is exactly what the click creates
 * (WYSIWYG). Translucent material + post-FX overlay + non-pickable + disposal live in
 * the shared `PlacementGhostOverlay` SSoT (ADR-537).
 */

import {
  buildMepFixtureEntity,
  buildDefaultMepFixtureParams,
} from '../../hooks/drawing/mep-fixture-completion';
import { computeMepFixtureGeometry } from '../../bim/mep-fixtures/mep-fixture-geometry';
import { fixtureToMesh } from '../converters/BimToThreeConverter';
import { mepFixtureToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-fixture-tool-bridge-store';
import type { MepFixtureEntity } from '../../bim/types/mep-fixture-types';
import { createPlacementGhostClass } from './create-placement-ghost';

/** Amber sanitary-fixture ghost tint (matches the committed fixture material family). */
export class MepFixturePlacementGhost extends createPlacementGhostClass<
  MepFixtureEntity,
  MepFixtureEntity['params'],
  NonNullable<ReturnType<typeof mepFixtureToolBridgeStore.get>>
>({
  color: 0xf59e0b,
  layerId: '__ghost-mep-fixture__',
  bridgeStore: mepFixtureToolBridgeStore,
  buildParams: (scenePoint, handle, units) =>
    buildDefaultMepFixtureParams(scenePoint, handle ? { ...handle.overrides, shape: handle.shape } : {}, units),
  computeGeometry: (params) => computeMepFixtureGeometry(params),
  buildEntity: (params, layerId) => buildMepFixtureEntity(params, layerId),
  toMesh: (entity, floorElevationMm, levelId) => fixtureToMesh(entity, floorElevationMm, levelId),
}) {}
