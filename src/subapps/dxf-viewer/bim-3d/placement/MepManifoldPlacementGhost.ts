'use client';

/**
 * MepManifoldPlacementGhost — translucent 3D preview of the manifold about to be
 * placed. ADR-408 Φ12. Built via the `createPlacementGhostClass` SSoT (ADR-618): the
 * ghost mesh is produced by the SAME path the commit uses
 * (`buildDefaultMepManifoldParams` → `computeMepManifoldGeometry` → `manifoldToMesh`)
 * and reads overrides from the SAME `mepManifoldToolBridgeStore` — so the preview is
 * exactly what the click creates (WYSIWYG). ADR-408 Φ14 — the ghost is recoloured
 * per-frame to match the committed equipment (water = cyan-teal, drainage collector =
 * brown) via the shared palette SSoT. Translucent material + post-FX overlay +
 * non-pickable + disposal live in the shared `PlacementGhostOverlay` SSoT (ADR-537).
 */

import {
  buildMepManifoldEntity,
  buildDefaultMepManifoldParams,
} from '../../hooks/drawing/mep-manifold-completion';
import { computeMepManifoldGeometry } from '../../bim/mep-manifolds/mep-manifold-geometry';
import { resolveManifoldPalette } from '../../bim/mep-manifolds/mep-manifold-symbol';
import { manifoldToMesh } from '../converters/BimToThreeConverter';
import { mepManifoldToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-manifold-tool-bridge-store';
import type { MepManifoldEntity } from '../../bim/types/mep-manifold-types';
import { createPlacementGhostClass } from './create-placement-ghost';

/** Base teal tint — overridden per-frame by the classification palette (water/drainage). */
export class MepManifoldPlacementGhost extends createPlacementGhostClass<
  MepManifoldEntity,
  MepManifoldEntity['params'],
  NonNullable<ReturnType<typeof mepManifoldToolBridgeStore.get>>
>({
  color: 0x14b8a6,
  layerId: '__ghost-mep-manifold__',
  bridgeStore: mepManifoldToolBridgeStore,
  buildParams: (scenePoint, handle, units) =>
    buildDefaultMepManifoldParams(scenePoint, handle ? { ...handle.overrides } : {}, units),
  computeGeometry: (params) => computeMepManifoldGeometry(params),
  buildEntity: (params, layerId) => buildMepManifoldEntity(params, layerId),
  toMesh: (entity, floorElevationMm, levelId) => manifoldToMesh(entity, floorElevationMm, levelId),
  resolveColor: (entity) => resolveManifoldPalette(entity.params.kind).strokeHex,
}) {}
