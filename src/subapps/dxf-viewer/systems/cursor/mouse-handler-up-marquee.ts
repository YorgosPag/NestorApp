/**
 * Mouse Up — Marquee / Point-click selection processing
 * Extracted from mouse-handler-up.ts (ADR-065 SRP split, file-size <500).
 * Pure helpers: window/crossing marquee, region/crop intercepts, lasso fallback,
 * single point hit-test. No React state — driven by a MarqueeContext snapshot.
 */

import {
  getPointerSnapshotFromElement,
  getScreenPosFromEvent,
  screenToWorldWithSnapshot,
} from '../../rendering/core/CoordinateTransforms';
import { isInDrawingMode } from '../tools/ToolStateManager';
import { isRegionBoxSelectTool } from '../tools/region-tool-ids';
import { UniversalMarqueeSelector } from '../selection/UniversalMarqueeSelection';
import { EventBus } from '../events/EventBus';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import type { CentralizedMouseHandlersProps } from './mouse-handler-types';
// ADR-358 Phase 9D-5b-ii Sub-D — Entity type bridge for performSelection narrow.
import type { Entity, SceneModel } from '../../types/entities';
// ADR-408 — circuits are derived (not scene entities), so the marquee selector can't see
// them; hit-test the same wire polylines the overlay draws for window/crossing selection.
import { useMepSystemStore } from '../../bim/mep-systems/mep-system-store';
import { resolveCircuitWirePaths } from '../../bim/mep-systems/mep-wire-scene';
import { selectCircuitsInMarquee } from '../../bim/mep-systems/mep-wire-hit';
// ADR-501 Slice 2 — grip marquee arming: a window over visible grips arms them
// (orange) instead of selecting new entities (AutoCAD/Revit "hot grips").
import { ArmableGripsStore } from '../grip/ArmableGripsStore';
import { runGripMarqueeArm } from '../grip/grip-marquee-arm';

export interface MarqueeContext {
  cursor: ReturnType<typeof import('./CursorSystem').useCursor>;
  transform: CentralizedMouseHandlersProps['transform'];
  viewport: CentralizedMouseHandlersProps['viewport'];
  canvasRef: CentralizedMouseHandlersProps['canvasRef'];
  colorLayers: CentralizedMouseHandlersProps['colorLayers'];
  scene: CentralizedMouseHandlersProps['scene'];
  hitTestCallback: CentralizedMouseHandlersProps['hitTestCallback'];
  onEntitySelect: CentralizedMouseHandlersProps['onEntitySelect'];
  onCanvasClick: CentralizedMouseHandlersProps['onCanvasClick'];
  onLayerSelected: CentralizedMouseHandlersProps['onLayerSelected'];
  onMultiLayerSelected: CentralizedMouseHandlersProps['onMultiLayerSelected'];
  onEntitiesSelected: CentralizedMouseHandlersProps['onEntitiesSelected'];
  onUnifiedMarqueeResult: CentralizedMouseHandlersProps['onUnifiedMarqueeResult'];
  activeTool: CentralizedMouseHandlersProps['activeTool'];
  overlayMode: CentralizedMouseHandlersProps['overlayMode'];
}

export function processMarqueeSelection(
  e: React.MouseEvent<HTMLCanvasElement>,
  ctx: MarqueeContext,
) {
  const { cursor, transform, canvasRef, colorLayers, scene,
    hitTestCallback, onEntitySelect, onCanvasClick,
    onLayerSelected, onMultiLayerSelected, onEntitiesSelected, onUnifiedMarqueeResult,
    activeTool, overlayMode } = ctx;

  const canvas = canvasRef?.current ?? null;
  const marqueeSnap = getPointerSnapshotFromElement(canvas);

  // ADR-501 Slice 2 — grip marquee: when grips are visible (a selection exists) and
  // the box catches ≥1 armable grip, arm those grips (orange) and CONSUME the
  // marquee — do NOT select entities. Only in grip mode (select/layering); with no
  // grip inside, falls through to the unchanged entity-marquee (no regression).
  if ((activeTool === 'select' || activeTool === 'layering') && marqueeSnap) {
    const armed = runGripMarqueeArm(
      cursor.selectionStart!,
      cursor.position!,
      transform,
      { width: marqueeSnap.rect.width, height: marqueeSnap.rect.height },
      e.shiftKey,
      ArmableGripsStore.getSnapshot(),
    );
    if (armed) return;
  }

  // ADR-363 Phase 1K Mode C / «Τοίχος από περίγραμμα» — box-select: intercept the
  // marquee → run window/crossing selection to collect entities → hand their ids to
  // the wall tool via EventBus (in-region detects enclosed rectangles; outer-perimeter
  // analyses the faces → leg walls). MUST NOT mutate selection (mirrors crop-window).
  if (isRegionBoxSelectTool(activeTool) && marqueeSnap) {
    const regionResult = UniversalMarqueeSelector.performSelection(
      cursor.selectionStart!,
      cursor.position!,
      transform,
      marqueeSnap.rect,
      {
        colorLayers: colorLayers ?? [],
        entities: (scene?.entities ?? []) as unknown as Entity[],
        tolerance: TOLERANCE_CONFIG.HIT_TEST_FALLBACK,
        enableDebugLogs: false,
        onLayerSelected: undefined,
        currentPosition: cursor.position!,
      },
    );
    const entityIds = regionResult.breakdown?.entityIds ?? [];
    if (entityIds.length > 0) {
      EventBus.emit('bim:wall-region-box-select', { entityIds });
    }
    return;
  }

  // Crop-window: intercept marquee → emit world-space rect, skip normal selection
  if (activeTool === 'crop-window' && marqueeSnap) {
    const worldStart = screenToWorldWithSnapshot(cursor.selectionStart!, transform, marqueeSnap);
    const worldEnd = screenToWorldWithSnapshot(cursor.position!, transform, marqueeSnap);
    EventBus.emit('crop:marquee-rect', {
      xMin: Math.min(worldStart.x, worldEnd.x),
      yMin: Math.min(worldStart.y, worldEnd.y),
      xMax: Math.max(worldStart.x, worldEnd.x),
      yMax: Math.max(worldStart.y, worldEnd.y),
    });
    return;
  }

  const hasMultiCallback = !!onMultiLayerSelected;
  const hasSingleCallback = !!onLayerSelected;
  const hasEntityCallback = !!onEntitiesSelected;
  const hasUnifiedCallback = !!onUnifiedMarqueeResult;

  if (!marqueeSnap || !(hasUnifiedCallback || hasMultiCallback || hasSingleCallback || hasEntityCallback)) return;

  const selectionResult = UniversalMarqueeSelector.performSelection(
    cursor.selectionStart!,
    cursor.position!,
    transform,
    marqueeSnap.rect,
    {
      colorLayers: colorLayers ?? [],
      // ADR-358 Phase 9D-5b-ii Sub-D — bridge cast: `SceneModel.entities: DxfEntityUnion[]` vs `Entity[]` expected by performSelection. Resolved at schema flip Phase 9D-5b-iii.
      entities: (scene?.entities ?? []) as unknown as Entity[],
      tolerance: TOLERANCE_CONFIG.HIT_TEST_FALLBACK,
      enableDebugLogs: false,
      onLayerSelected: undefined,
      currentPosition: cursor.position!,
    }
  );

  // Small selection = point click, large empty selection = deselect.
  const selectionWidth = Math.abs(cursor.position!.x - cursor.selectionStart!.x);
  const selectionHeight = Math.abs(cursor.position!.y - cursor.selectionStart!.y);
  const MIN_MARQUEE_SIZE = 5;
  const isSmallSelection = selectionWidth < MIN_MARQUEE_SIZE && selectionHeight < MIN_MARQUEE_SIZE;

  // ADR-408 — window/crossing over circuit home-run wires. Only for real drag boxes: a
  // click-sized box is a wire CLICK, owned by the wire-click pointer FSM, not the marquee.
  // Uses the result's own world bounds + window/crossing verdict (zero recomputation).
  let circuitIds: string[] = [];
  if (!isSmallSelection) {
    // ADR-358 bridge cast (same as the entities narrow above) — DxfScene ⇄ SceneModel.
    const paths = resolveCircuitWirePaths(scene as unknown as SceneModel, useMepSystemStore.getState().systems);
    if (paths.length > 0) {
      circuitIds = selectCircuitsInMarquee(
        selectionResult.selectionBounds,
        selectionResult.selectionType === 'crossing',
        paths,
      );
    }
  }

  if (selectionResult.selectedIds.length > 0 || circuitIds.length > 0) {
    const breakdown = selectionResult.breakdown;
    const layerAndOverlayIds = [...(breakdown?.layerIds ?? []), ...(breakdown?.overlayIds ?? [])];
    const entityIds = breakdown?.entityIds ?? [];

    if (hasUnifiedCallback) {
      onUnifiedMarqueeResult!({ layerIds: layerAndOverlayIds, entityIds, circuitIds, subtract: e.shiftKey });
    } else {
      if (layerAndOverlayIds.length > 0) {
        if (hasMultiCallback) onMultiLayerSelected!(layerAndOverlayIds);
        else if (hasSingleCallback) layerAndOverlayIds.forEach(id => onLayerSelected!(id, cursor.position!));
      }
      if (entityIds.length > 0 && hasEntityCallback) onEntitiesSelected!(entityIds);
    }
  } else {
    if (isSmallSelection) {
      processPointClick(e, ctx);
    } else if (onCanvasClick) {
      const emptySnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
      if (!emptySnap) return;
      const emptyScreenPos = getScreenPosFromEvent(e, emptySnap);
      const worldPt = screenToWorldWithSnapshot(emptyScreenPos, transform, emptySnap);
      onCanvasClick(worldPt, e.shiftKey);
    }
  }
}

export function processPointClick(
  e: React.MouseEvent<HTMLCanvasElement>,
  ctx: MarqueeContext,
) {
  const { transform, colorLayers, hitTestCallback, onEntitySelect, onCanvasClick,
    onLayerSelected, onMultiLayerSelected, scene, activeTool, overlayMode } = ctx;

  const hitTestSnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
  if (!hitTestSnap) return;
  const freshScreenPos = getScreenPosFromEvent(e, hitTestSnap);
  const worldPoint = screenToWorldWithSnapshot(freshScreenPos, transform, hitTestSnap);

  // Step 1: Check overlay polygons (point-in-polygon)
  let hitLayerId: string | null = null;
  if (colorLayers && colorLayers.length > 0) {
    for (const layer of colorLayers) {
      if (!layer.polygons || layer.polygons.length === 0) continue;
      for (const polygon of layer.polygons) {
        if (!polygon.vertices || polygon.vertices.length < 3) continue;
        const vertices = polygon.vertices;
        let inside = false;
        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
          const xi = vertices[i].x, yi = vertices[i].y;
          const xj = vertices[j].x, yj = vertices[j].y;
          if (((yi > worldPoint.y) !== (yj > worldPoint.y)) &&
              (worldPoint.x < (xj - xi) * (worldPoint.y - yi) / (yj - yi) + xi)) {
            inside = !inside;
          }
        }
        if (inside) { hitLayerId = layer.id; break; }
      }
      if (hitLayerId) break;
    }
  }

  if (hitLayerId) {
    if (onMultiLayerSelected) onMultiLayerSelected([hitLayerId]);
    else if (onLayerSelected) onLayerSelected(hitLayerId, freshScreenPos);
  } else if (hitTestCallback && onEntitySelect) {
    const isDrawing = isInDrawingMode(activeTool, overlayMode);
    if (!isDrawing) {
      const hitResult = hitTestCallback(scene, freshScreenPos, transform, hitTestSnap.viewport);
      if (hitResult) onEntitySelect(hitResult, e.shiftKey || e.ctrlKey || e.metaKey);
    }
    if (onCanvasClick) onCanvasClick(worldPoint, e.shiftKey);
  } else if (onCanvasClick) {
    onCanvasClick(worldPoint, e.shiftKey);
  }
}
