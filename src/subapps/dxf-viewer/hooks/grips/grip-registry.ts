/**
 * ADR-183: Unified Grip System — Grip Registry
 *
 * Collects ALL grips (DXF + overlay) into a single UnifiedGripInfo[] array.
 * Pure computation — no React state, no side effects.
 *
 * @see unified-grip-types.ts — type definitions
 * @see useDxfGripInteraction.ts — computeDxfEntityGrips (DXF entity → grips)
 * @see entity-conversion.ts — findOverlayEdgeForGrip (overlay edge detection)
 */

import { useMemo } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { DxfScene, DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Overlay } from '../../overlays/types';
import type { GripInfo } from '../useGripMovement';
import { computeDxfEntityGrips } from '../grip-computation';
import { calculateMidpoint } from '../../rendering/entities/shared/geometry-utils';
import type { UnifiedGripInfo } from './unified-grip-types';
import { useGripStyle } from '../../stores/GripStyleStore';
import { isGripObjLimitExceeded } from './grip-obj-limit';
// ADR-397 Φ2 — directional move: attach the entity's local frame + mm scale to its
// MOVE grip so the click handler can move along a typed distance without the scene.
import { resolveMoveGlyphFrame } from '../../bim/grips/move-glyph-frame';
import { hotGripKindOf, hotGripOpForKind } from './wall-hot-grip-fsm';
import { mmScaleFor } from '../../utils/scene-units';
import type { Entity } from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';

// ============================================================================
// PURE: Wrap DXF GripInfo → UnifiedGripInfo
// ============================================================================

function wrapDxfGrip(grip: GripInfo): UnifiedGripInfo {
  return {
    id: `dxf_${grip.entityId}_${grip.gripIndex}`,
    source: 'dxf',
    entityId: grip.entityId,
    gripIndex: grip.gripIndex,
    // 'corner' → 'vertex' (a corner IS a vertex of the entity outline, NOT a midpoint).
    // Previously bundled με 'midpoint' → 'edge' → filtered by `!showMidpoints` even
    // όταν ο χρήστης ήθελε corners visible. ADR-363 Phase 1C-bis wall corner grips
    // πρέπει να φαίνονται ανεξάρτητα από το showMidpoints preference. Direct-
    // manipulation principle: pickable corners are primary editing affordances.
    type: grip.type === 'corner' ? 'vertex' : grip.type === 'midpoint' ? 'edge' : grip.type,
    position: grip.position,
    movesEntity: grip.movesEntity,
    edgeVertexIndices: grip.edgeVertexIndices,
    // ADR-358 Phase 5b — forward stair parametric grip discriminator.
    ...(grip.stairGripKind ? { stairGripKind: grip.stairGripKind } : {}),
    // ADR-362 Phase I2 — forward dimension grip discriminator.
    ...(grip.dimGripKind ? { dimGripKind: grip.dimGripKind } : {}),
    // ADR-363 Phase 1C — forward wall parametric grip discriminator.
    ...(grip.wallGripKind ? { wallGripKind: grip.wallGripKind } : {}),
    // ADR-363 Phase 2.5 — forward opening parametric grip discriminator.
    ...(grip.openingGripKind ? { openingGripKind: grip.openingGripKind } : {}),
    // ADR-363 Phase 3.5 — forward slab parametric grip discriminator.
    ...(grip.slabGripKind ? { slabGripKind: grip.slabGripKind } : {}),
    // ADR-363 Phase 3.7a — forward slab-opening parametric grip discriminator.
    ...(grip.slabOpeningGripKind ? { slabOpeningGripKind: grip.slabOpeningGripKind } : {}),
    // ADR-417 Φ1-part-2 #2 — forward roof parametric grip discriminator.
    ...(grip.roofGripKind ? { roofGripKind: grip.roofGripKind } : {}),
    // ADR-363 Phase 5.5a — forward beam parametric grip discriminator.
    ...(grip.beamGripKind ? { beamGripKind: grip.beamGripKind } : {}),
    // ADR-363 Phase 4.5 — forward column parametric grip discriminator.
    ...(grip.columnGripKind ? { columnGripKind: grip.columnGripKind } : {}),
    // ADR-436 Slice 1b — forward foundation parametric grip discriminator.
    ...(grip.foundationGripKind ? { foundationGripKind: grip.foundationGripKind } : {}),
    // ADR-406 — forward MEP fixture parametric grip discriminator.
    ...(grip.mepFixtureGripKind ? { mepFixtureGripKind: grip.mepFixtureGripKind } : {}),
    // ADR-408 Φ3 — forward electrical panel parametric grip discriminator.
    ...(grip.electricalPanelGripKind ? { electricalPanelGripKind: grip.electricalPanelGripKind } : {}),
    // ADR-408 Φ12 — forward MEP manifold parametric grip discriminator.
    ...(grip.mepManifoldGripKind ? { mepManifoldGripKind: grip.mepManifoldGripKind } : {}),
    // ADR-408 Εύρος Β — forward heating radiator parametric grip discriminator.
    ...(grip.mepRadiatorGripKind ? { mepRadiatorGripKind: grip.mepRadiatorGripKind } : {}),
    // ADR-408 Εύρος Β #2 — forward heating boiler parametric grip discriminator.
    ...(grip.mepBoilerGripKind ? { mepBoilerGripKind: grip.mepBoilerGripKind } : {}),
    // ADR-408 Φ8/Φ15 — forward MEP segment parametric grip discriminator.
    ...(grip.mepSegmentGripKind ? { mepSegmentGripKind: grip.mepSegmentGripKind } : {}),
    // ADR-410 — forward furniture parametric grip discriminator.
    ...(grip.furnitureGripKind ? { furnitureGripKind: grip.furnitureGripKind } : {}),
    // ADR-415 — forward floorplan-symbol parametric grip discriminator.
    ...(grip.floorplanSymbolGripKind ? { floorplanSymbolGripKind: grip.floorplanSymbolGripKind } : {}),
    // ADR-419 — forward floor-finish parametric grip discriminator.
    ...(grip.floorFinishGripKind ? { floorFinishGripKind: grip.floorFinishGripKind } : {}),
    // ADR-507 — forward hatch boundary grip discriminator.
    ...(grip.hatchGripKind ? { hatchGripKind: grip.hatchGripKind } : {}),
    // ADR-408 Εύρος Β #3 — forward underfloor heating loop parametric grip discriminator.
    ...(grip.mepUnderfloorGripKind ? { mepUnderfloorGripKind: grip.mepUnderfloorGripKind } : {}),
    // ADR-359 Phase 11 — forward XLine grip discriminator.
    ...(grip.xlineGripKind ? { xlineGripKind: grip.xlineGripKind } : {}),
    // ADR-359 Phase 11 — forward Ray grip discriminator.
    ...(grip.rayGripKind ? { rayGripKind: grip.rayGripKind } : {}),
    // ADR-510 Φ3c — forward multifunctional polyline grip discriminator.
    ...(grip.polylineGripKind ? { polylineGripKind: grip.polylineGripKind } : {}),
    // ADR-363 Slice F — forward line rotation grip discriminator (shared hot-grip rotate).
    ...(grip.lineGripKind ? { lineGripKind: grip.lineGripKind } : {}),
    // ADR-557 — forward text/mtext rect-box grip discriminator.
    ...(grip.textGripKind ? { textGripKind: grip.textGripKind } : {}),
  };
}

// ============================================================================
// PURE: Compute overlay grips (vertex + edge midpoints)
// ============================================================================

/**
 * Generate UnifiedGripInfo[] for a single overlay polygon.
 * Vertex grips at each corner, edge midpoints between consecutive vertices.
 */
export function computeOverlayGrips(overlayId: string, polygon: Array<[number, number]>): UnifiedGripInfo[] {
  if (!polygon || polygon.length < 2) return [];

  const grips: UnifiedGripInfo[] = [];

  // Vertex grips
  for (let i = 0; i < polygon.length; i++) {
    grips.push({
      id: `overlay_${overlayId}_v${i}`,
      source: 'overlay',
      overlayId,
      gripIndex: i,
      type: 'vertex',
      position: { x: polygon[i][0], y: polygon[i][1] },
      movesEntity: false,
    });
  }

  // Edge midpoint grips (between consecutive vertices, polygon is closed)
  for (let i = 0; i < polygon.length; i++) {
    const next = (i + 1) % polygon.length;
    const p1: Point2D = { x: polygon[i][0], y: polygon[i][1] };
    const p2: Point2D = { x: polygon[next][0], y: polygon[next][1] };
    const mid = calculateMidpoint(p1, p2);

    grips.push({
      id: `overlay_${overlayId}_e${i}`,
      source: 'overlay',
      overlayId,
      gripIndex: polygon.length + i, // offset past vertex grips
      type: 'edge',
      position: mid,
      movesEntity: false,
      edgeInsertIndex: i + 1, // vertex insertion index
    });
  }

  return grips;
}

// ============================================================================
// HOOK: Memoized collection of all grips
// ============================================================================

interface UseGripRegistryParams {
  /** DXF scene (for entity geometry) */
  dxfScene: DxfScene | null;
  /** Currently selected DXF entity IDs */
  selectedEntityIds: string[];
  /** Currently selected overlay objects */
  selectedOverlays: Overlay[];
}

/**
 * Memoized collection of ALL grips (DXF + overlay) as UnifiedGripInfo[].
 * Recomputes only when selection, scene data, or grip style settings change.
 */
export function useGripRegistry({
  dxfScene,
  selectedEntityIds,
  selectedOverlays,
}: UseGripRegistryParams): UnifiedGripInfo[] {
  const { showMidpoints, showCenters, maxGripsPerEntity, gripObjLimit } = useGripStyle();

  return useMemo(() => {
    const result: UnifiedGripInfo[] = [];

    // ADR-559 — AutoCAD GRIPOBJLIMIT: when the selection holds MORE objects than the
    // limit, suppress ALL grips (entities stay selected; only grip rendering is skipped
    // for performance). `0` = no limit. Distinct from `maxGripsPerEntity` (the
    // per-single-entity grip cap applied in the loop below). Shared rule SSoT.
    const selectedCount = selectedEntityIds.length + selectedOverlays.length;
    if (isGripObjLimitExceeded(selectedCount, gripObjLimit)) {
      return result;
    }

    // 1. DXF entity grips
    if (dxfScene && selectedEntityIds.length > 0) {
      const entityMap = new Map<string, DxfEntityUnion>();
      for (const entity of dxfScene.entities) {
        entityMap.set(entity.id, entity);
      }
      for (const entityId of selectedEntityIds) {
        const entity = entityMap.get(entityId);
        if (entity) {
          const dxfGrips = computeDxfEntityGrips(entity);
          // ADR-397 Φ2 — resolve the entity's local frame + mm scale ONCE; attach to
          // its MOVE grip so the directional click can translate by a typed distance.
          const moveFrame = resolveMoveGlyphFrame(entity as unknown as Entity);
          const mmScale = moveFrame
            ? mmScaleFor(((entity as { params?: { sceneUnits?: SceneUnits | null } }).params) ?? {})
            : 1;
          let count = 0;
          for (const grip of dxfGrips) {
            if (count >= maxGripsPerEntity) break;
            const wrapped = wrapDxfGrip(grip);
            if (!showMidpoints && wrapped.type === 'edge') continue;
            if (!showCenters && wrapped.type === 'center') continue;
            const withFrame = moveFrame && hotGripOpForKind(hotGripKindOf(wrapped)) === 'move'
              ? { ...wrapped, moveGlyphFrame: moveFrame, moveGlyphMmScale: mmScale }
              : wrapped;
            result.push(withFrame);
            count++;
          }
        }
      }
    }

    // 2. Overlay grips
    for (const overlay of selectedOverlays) {
      if (overlay.polygon && overlay.polygon.length >= 2) {
        const overlayGrips = computeOverlayGrips(overlay.id, overlay.polygon);
        for (const grip of overlayGrips) {
          if (!showMidpoints && grip.type === 'edge') continue;
          result.push(grip);
        }
      }
    }

    return result;
  }, [dxfScene, selectedEntityIds, selectedOverlays, showMidpoints, showCenters, maxGripsPerEntity, gripObjLimit]);
}
