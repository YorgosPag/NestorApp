/**
 * ADR-587 Φ5 — flat non-BIM `TO_DXF` handlers (image / topo-surface / leader), extracted
 * from {@link ./dxf-scene-entity-handlers} so that file stays ≤500 LOC (Google SRP, N.7.1).
 *
 * Same introspectable seam: these keys are spread into `TO_DXF_HANDLERS` and bound to the
 * descriptor domain by the same `__tests__/dxf-scene-entity-toDxf-coverage.test.ts`. Every
 * handler is a thin adapter — a type-guard + a flat top-level spread of the entity's own
 * fields (no `geometry`/`params` quartet), so the matching leaf renderer receives them
 * directly. An absent handler ⇒ the dispatcher's `warn+null` default (the ADR-583/612/651
 * drop trap these three cases exist to avoid).
 *
 * @see ./dxf-scene-entity-handlers.ts — the full `TO_DXF_HANDLERS` registry (BIM + primitives)
 */

import type { EntityType } from '../../types/base-entity';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ToDxfHandler } from './dxf-scene-entity-handlers';
// ADR-651 Φάση Ε — standalone raster image lightweight entity for DXF render pipeline.
import type { ImageEntity } from '../../types/image';
import { isImageEntity } from '../../types/image';
// ADR-662 Φάση 2β (Δρόμος Γ) — thin/derived topo surface entity for DXF render pipeline.
import type { TopoSurfaceEntity } from '../../types/topo-surface';
import { isTopoSurfaceEntity } from '../../types/topo-surface';
// ADR-635 Φάση B — leader callout annotation entity for DXF render pipeline.
import type { LeaderEntity } from '../../types/entities';
import { isLeaderEntity } from '../../types/entities';

export const FLAT_NONBIM_TO_DXF_HANDLERS: Partial<Record<EntityType, ToDxfHandler>> = {
  image: (entity, base) => {
    // ADR-651 Φάση Ε — lightweight non-BIM raster image (sibling of scale-bar/opening-info-tag).
    // Flat params spread at top level; ImageRenderer reads them + the shared HatchImageCache.
    // Without this case the freshly-placed image would fall to `default` → null → invisible +
    // un-grippable (the same drop trap as the BIM entities).
    if (!isImageEntity(entity)) return null;
    const img = entity as ImageEntity;
    return {
      ...base, type: 'image' as const,
      position: img.position, width: img.width, height: img.height, url: img.url,
      ...(img.rotation !== undefined ? { rotation: img.rotation } : {}),
    } as DxfEntityUnion;
  },
  'topo-surface': (entity, base) => {
    // ADR-662 Φάση 2β (Δρόμος Γ) — thin/derived non-BIM topo surface (sibling of image).
    // Flat params spread at top level (surfaceId + footprint); TopoSurfaceRenderer draws
    // the footprint outline. Without this case the surface entity would fall to `default`
    // → null → invisible + un-selectable (the same drop trap as the entities above).
    if (!isTopoSurfaceEntity(entity)) return null;
    const ts = entity as TopoSurfaceEntity;
    return {
      ...base, type: 'topo-surface' as const,
      surfaceId: ts.surfaceId, footprint: ts.footprint,
    } as DxfEntityUnion;
  },
  leader: (entity, base) => {
    // ADR-635 Φάση B — non-BIM leader callout (sibling of the annotation family). Flat fields
    // spread at top level (vertices path + arrowHead + optional annotation text/hook);
    // LeaderRenderer strokes the path + stamps the tip arrowhead. Without this case the
    // imported DXF LEADER (convertLeader → scene) fell to `default` → null → invisible on the
    // 2D canvas even though LeaderRenderer is registered (the ADR-583/612/651 drop trap).
    if (!isLeaderEntity(entity)) return null;
    const l = entity as LeaderEntity;
    return {
      ...base, type: 'leader' as const,
      vertices: l.vertices,
      ...(l.arrowHead !== undefined ? { arrowHead: l.arrowHead } : {}),
      ...(l.annotationText !== undefined ? { annotationText: l.annotationText } : {}),
      ...(l.annotationPosition !== undefined ? { annotationPosition: l.annotationPosition } : {}),
      ...(l.hookLineLength !== undefined ? { hookLineLength: l.hookLineLength } : {}),
      ...(l.hasHookLine !== undefined ? { hasHookLine: l.hasHookLine } : {}),
    } as DxfEntityUnion;
  },
};
