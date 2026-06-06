/**
 * Mouse Up Handler — ADR-065 SRP split
 * Extracted from useCentralizedMouseHandlers.ts
 * Handles: pan cleanup, grip release, drawing clicks, marquee selection, point-click pipeline
 */

import { useCallback } from 'react';
import {
  CoordinateTransforms,
  getPointerSnapshotFromElement,
  getScreenPosFromEvent,
  screenToWorldWithSnapshot,
} from '../../rendering/core/CoordinateTransforms';
import { canvasEventBus } from '../../rendering/canvas/core/CanvasEventSystem';
import { isInDrawingMode } from '../tools/ToolStateManager';
import { UniversalMarqueeSelector } from '../selection/UniversalMarqueeSelection';
import { EventBus } from '../events/EventBus';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import type { CentralizedMouseHandlersProps, MouseHandlerRefs, SnapManagerAPI } from './mouse-handler-types';
// ADR-358 Phase 9D-5b-ii Sub-D — Entity type bridge for performSelection narrow.
import type { Entity } from '../../types/entities';
// ADR-362 hotfix Round 3 (2026-05-19) — skip upstream click-snap on dim-line-offset
// pick so committed defPoints[2] matches the cursor (not a nearby entity endpoint).
// Round 1+2 gated snap only in the downstream `useDrawingHandlers.onDrawingPoint`,
// but the click world point was already snapped here BEFORE reaching that gate.
import { isDimLineRefPhase } from '../../hooks/dimensions/dim-skip-snap';
import { getActiveDragGrip } from './GripDragStore';
import { findWallFaceCornerSnap } from './wall-face-corner-snap';
import { isWallEntity, isColumnEntity } from '../../types/entities';
import {
  findColumnGripCornerSnap,
  findColumnDrawCornerSnap,
  isColumnCornerSnapGrip,
} from '../../bim/columns/column-corner-snap';
import type { ColumnGripKind } from '../../hooks/useGripMovement';
import { columnToolBridgeStore } from '../../ui/ribbon/hooks/bridge/column-tool-bridge-store';
import { ExtendedSnapType } from '../../snapping/extended-types';
import { resolveMepConnectorElevationMmAt } from '../../bim/mep-segments/mep-connector-elevation';
import { LassoStore, computeLassoMode } from './LassoStore';
import { ZoomWindowStore } from '../zoom-window/ZoomWindowStore';

interface MouseUpHandlerDeps {
  props: CentralizedMouseHandlersProps;
  cursor: ReturnType<typeof import('./CursorSystem').useCursor>;
  refs: MouseHandlerRefs;
  snap: SnapManagerAPI;
}

export function useMouseUpHandler({ props, cursor, refs, snap }: MouseUpHandlerDeps) {
  const {
    transform, viewport, onTransformChange, onEntitySelect, hitTestCallback,
    scene, colorLayers, onLayerSelected, onMultiLayerSelected, canvasRef,
    onCanvasClick, activeTool, overlayMode, onEntitiesSelected,
    onUnifiedMarqueeResult, onGripMouseUp,
  } = props;
  const { snapEnabled, findSnapPoint } = snap;

  return useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    cursor.setMouseDown(false);

    // ADR-374 — ZOOM Window finish: screen rect → world bounds → fit-to-view via EventBus.
    if (activeTool === 'zoom-window' && e.button === 0 && ZoomWindowStore.isActive()) {
      const screenRect = ZoomWindowStore.finish();
      if (screenRect) {
        const upSnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
        if (upSnap) {
          const w1 = screenToWorldWithSnapshot(
            { x: screenRect.x, y: screenRect.y },
            transform,
            upSnap,
          );
          const w2 = screenToWorldWithSnapshot(
            { x: screenRect.x + screenRect.width, y: screenRect.y + screenRect.height },
            transform,
            upSnap,
          );
          EventBus.emit('zoom-window:apply', {
            worldBounds: {
              min: { x: Math.min(w1.x, w2.x), y: Math.min(w1.y, w2.y) },
              max: { x: Math.max(w1.x, w2.x), y: Math.max(w1.y, w2.y) },
            },
            viewport: upSnap.viewport,
          });
        }
      }
      return;
    }

    // Pan cleanup
    const panState = refs.panStateRef.current;
    const wasPanning = panState.isPanning;

    if (panState.isPanning) {
      panState.isPanning = false;
      panState.lastMousePos = null;

      if (panState.pendingTransform && onTransformChange) {
        onTransformChange(panState.pendingTransform);
        canvasEventBus.emitTransformChange(panState.pendingTransform, viewport, 'dxf-canvas');
        panState.pendingTransform = null;
      }

      if (panState.animationId) {
        cancelAnimationFrame(panState.animationId);
        panState.animationId = null;
      }
    }

    // Grip drag-release with snap
    if (e.button === 0 && onGripMouseUp) {
      const upSnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
      if (upSnap) {
        const upScreenPos = getScreenPosFromEvent(e, upSnap);
        let upWorldPos = screenToWorldWithSnapshot(upScreenPos, transform, upSnap);
        // ADR-398 — raw cursor (pre center-snap) for the column corner projection,
        // so the committed delta matches the preview (which used the raw cursor).
        const rawUpWorldPos = upWorldPos;

        if (snapEnabled && findSnapPoint) {
          const snapResult = findSnapPoint(upWorldPos.x, upWorldPos.y);
          if (snapResult && snapResult.found && snapResult.snappedPoint) {
            upWorldPos = snapResult.snappedPoint;
          }

          // ADR-371 extension — Wall Face Corner Projection Snap commit
          // Apply the same face corner projection on mouseup so the committed
          // entity position matches what was shown during drag preview.
          const activeDragGrip = getActiveDragGrip();
          if (
            activeDragGrip &&
            scene &&
            (activeDragGrip.gripKind === 'wall-start' || activeDragGrip.gripKind === 'wall-end')
          ) {
            const draggedEntity = scene.entities?.find(en => en.id === activeDragGrip.entityId) as unknown as import('../../types/entities').Entity | undefined;
            if (draggedEntity && isWallEntity(draggedEntity)) {
              const faceSnap = findWallFaceCornerSnap(
                draggedEntity,
                activeDragGrip.gripKind as 'wall-start' | 'wall-end',
                upWorldPos,
                findSnapPoint,
              );
              if (faceSnap) {
                upWorldPos = faceSnap.adjustedAxisPos;
              }
            }
          }

          // ADR-398 — Column Body Corner Projection Snap commit (move + resize).
          // Mirror of the move handler so the committed position equals the ghost.
          if (
            activeDragGrip &&
            activeDragGrip.dragAnchor &&
            scene &&
            isColumnCornerSnapGrip(activeDragGrip.gripKind)
          ) {
            const draggedColumn = scene.entities?.find(en => en.id === activeDragGrip.entityId) as unknown as import('../../types/entities').Entity | undefined;
            if (draggedColumn && isColumnEntity(draggedColumn)) {
              const cornerSnap = findColumnGripCornerSnap(
                draggedColumn,
                activeDragGrip.gripKind as ColumnGripKind,
                activeDragGrip.dragAnchor,
                rawUpWorldPos,
                findSnapPoint,
              );
              if (cornerSnap) {
                upWorldPos = cornerSnap.adjustedCursorPos;
              }
            }
          }
        }

        if (onGripMouseUp(upWorldPos)) {
          cursor.endSelection();
          return;
        }
      }
    }

    // Clear lasso button-held state on every mouseup.
    refs.lassoDownRef.current.buttonHeld = false;

    // Drawing tools click (left button only, not after pan)
    const isLeftClick = e.button === 0;

    if (onCanvasClick && isLeftClick && !cursor.isSelecting && !wasPanning && !LassoStore.getIsLasso()) {
      const clickSnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
      if (!clickSnap) return;

      const freshScreenPos = getScreenPosFromEvent(e, clickSnap);
      let worldPoint = screenToWorldWithSnapshot(freshScreenPos, transform, clickSnap);
      // ADR-408 Φ-B1 — connector-mate: when a click snaps to an MEP connector, the
      // connector's TRUE 3D elevation (mm) is captured here and threaded to the tool
      // so a pipe/duct endpoint inherits it (Revit "Connect To"). null = free point.
      let connectorZmm: number | null = null;

      // ADR-362 Round-3 hotfix: linear/aligned dim-line-offset pick is a free
      // position — AutoCAD disables OSNAP for it. Without this gate the click
      // gets snapped to a nearby entity endpoint and the committed dim jumps
      // to a wrong Y. Downstream `useDrawingHandlers` also gates snap on the
      // same predicate (symmetric with `drawing-hover-handler` on the hover side).
      const dimLineRefPhase = isDimLineRefPhase();
      if (snapEnabled && findSnapPoint && !dimLineRefPhase) {
        // ADR-398 — Column draw: a corner projection match shifts the commit
        // anchor so the corner lands on the target (matches the ghost). Falls
        // back to the plain cursor snap when no corner is near a target.
        const colHandle = activeTool === 'column' ? columnToolBridgeStore.get() : null;
        const drawCorner = colHandle?.isActive
          ? findColumnDrawCornerSnap(
              worldPoint,
              { ...colHandle.overrides, kind: colHandle.kind, anchor: colHandle.anchor },
              colHandle.getSceneUnits(),
              findSnapPoint,
            )
          : null;
        if (drawCorner) {
          worldPoint = drawCorner.adjustedCursorPos;
        } else {
          const snapResult = findSnapPoint(worldPoint.x, worldPoint.y);
          if (snapResult && snapResult.found && snapResult.snappedPoint) {
            worldPoint = snapResult.snappedPoint;
            // ADR-408 Φ-B1 — recover the connector's 3D elevation from the snapped
            // host so the segment tool can mate the endpoint in xyz. The snap only
            // carries plan (x,y); z is resolved per host type (segment per-endpoint,
            // manifold/fixture mounting datum). Harmless to non-segment tools.
            const cand = snapResult.snapPoint;
            if (cand && cand.type === ExtendedSnapType.BIM_MEP_CONNECTOR && cand.entityId && scene) {
              const host = scene.entities?.find((en) => en.id === cand.entityId) as Entity | undefined;
              if (host) {
                const zMm = resolveMepConnectorElevationMmAt(host, worldPoint.x, worldPoint.y);
                if (zMm !== null) connectorZmm = zMm;
              }
            }
          }
        }
      }

      const clickPoint = connectorZmm !== null
        ? { x: worldPoint.x, y: worldPoint.y, z: connectorZmm }
        : worldPoint;
      onCanvasClick(clickPoint, e.shiftKey);
    }

    // Lasso selection (button-held drag → free-form polygon).
    // MUST run before the two-click marquee block — mutually exclusive.
    if (LassoStore.getIsLasso()) {
      const finalLasso = LassoStore.endLasso();
      const lassoPath = finalLasso.lassoPath as import('../../rendering/types/Types').Point2D[];

      if (lassoPath.length >= 3) {
        const canvas = canvasRef?.current ?? null;
        const lassoSnap = getPointerSnapshotFromElement(canvas);
        if (lassoSnap) {
          const lassoMode = computeLassoMode(lassoPath);
          const result = UniversalMarqueeSelector.performLassoSelection(
            lassoPath,
            lassoMode,
            transform,
            lassoSnap.rect,
            {
              colorLayers: colorLayers ?? [],
              entities: (scene?.entities ?? []) as unknown as Entity[],
              enableDebugLogs: false,
            },
          );

          if (result.selectedIds.length > 0) {
            const { layerIds, overlayIds, entityIds } = result.breakdown ?? {};
            const allLayerIds = [...(layerIds ?? []), ...(overlayIds ?? [])];

            if (onUnifiedMarqueeResult) {
              onUnifiedMarqueeResult({ layerIds: allLayerIds, entityIds: entityIds ?? [], subtract: e.shiftKey });
            } else {
              if (allLayerIds.length > 0 && onMultiLayerSelected) onMultiLayerSelected(allLayerIds);
              if ((entityIds ?? []).length > 0 && onEntitiesSelected) onEntitiesSelected(entityIds!);
            }
          } else if (onCanvasClick) {
            // Empty lasso on empty space → deselect (same as empty marquee).
            const emptySnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
            if (emptySnap) {
              const emptyScreenPos = getScreenPosFromEvent(e, emptySnap);
              onCanvasClick(screenToWorldWithSnapshot(emptyScreenPos, transform, emptySnap), e.shiftKey);
            }
          }
        }
      }
      return;
    }

    // Marquee selection processing
    if (cursor.isSelecting && cursor.selectionStart && cursor.position) {
      processMarqueeSelection(e, {
        cursor, transform, viewport, canvasRef, colorLayers, scene,
        hitTestCallback, onEntitySelect, onCanvasClick, onLayerSelected,
        onMultiLayerSelected, onEntitiesSelected, onUnifiedMarqueeResult,
        activeTool, overlayMode,
      });
      cursor.endSelection();
    } else if (cursor.position && hitTestCallback) {
      // Single point hit-test (no marquee)
      const isDrawing = isInDrawingMode(activeTool, overlayMode);
      if (!isDrawing) {
        const canvasForHit = canvasRef?.current ?? null;
        const hitSnap = getPointerSnapshotFromElement(canvasForHit);
        if (!hitSnap) return;
        const hitResult = hitTestCallback(scene, cursor.position, transform, hitSnap.viewport);
        if (onEntitySelect) onEntitySelect(hitResult, e.shiftKey || e.ctrlKey || e.metaKey);
        // No entity + select tool + clean left-click → start two-click selection (AutoCAD: click→move→click)
        if (!hitResult && activeTool === 'select' && e.button === 0 && !wasPanning &&
            !(e.shiftKey || e.ctrlKey || e.metaKey)) {
          cursor.startSelection(getScreenPosFromEvent(e, hitSnap));
        }
      }
    }
  }, [cursor, onTransformChange, viewport, hitTestCallback, scene, transform, onEntitySelect, colorLayers, onLayerSelected, onMultiLayerSelected, canvasRef, onCanvasClick, activeTool, overlayMode, snapEnabled, findSnapPoint, onGripMouseUp, onEntitiesSelected, onUnifiedMarqueeResult, refs]);
}

// ===== Marquee Selection Processing (extracted for readability) =====

interface MarqueeContext {
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

function processMarqueeSelection(
  e: React.MouseEvent<HTMLCanvasElement>,
  ctx: MarqueeContext,
) {
  const { cursor, transform, canvasRef, colorLayers, scene,
    hitTestCallback, onEntitySelect, onCanvasClick,
    onLayerSelected, onMultiLayerSelected, onEntitiesSelected, onUnifiedMarqueeResult,
    activeTool, overlayMode } = ctx;

  const canvas = canvasRef?.current ?? null;
  const marqueeSnap = getPointerSnapshotFromElement(canvas);

  // ADR-363 Phase 1K Mode C / «Τοίχος από περίγραμμα» — box-select: intercept the
  // marquee → run window/crossing selection to collect entities → hand their ids to
  // the wall tool via EventBus (in-region detects enclosed rectangles; outer-perimeter
  // analyses the faces → leg walls). MUST NOT mutate selection (mirrors crop-window).
  if (
    (activeTool === 'wall-in-region' ||
      activeTool === 'wall-from-perimeter' ||
      activeTool === 'column-from-perimeter' ||
      activeTool === 'column-discrete-from-perimeter' ||
      activeTool === 'column-in-region') &&
    marqueeSnap
  ) {
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

  if (selectionResult.selectedIds.length > 0) {
    const breakdown = selectionResult.breakdown;
    const layerAndOverlayIds = [...(breakdown?.layerIds ?? []), ...(breakdown?.overlayIds ?? [])];
    const entityIds = breakdown?.entityIds ?? [];

    if (hasUnifiedCallback) {
      onUnifiedMarqueeResult!({ layerIds: layerAndOverlayIds, entityIds, subtract: e.shiftKey });
    } else {
      if (layerAndOverlayIds.length > 0) {
        if (hasMultiCallback) onMultiLayerSelected!(layerAndOverlayIds);
        else if (hasSingleCallback) layerAndOverlayIds.forEach(id => onLayerSelected!(id, cursor.position!));
      }
      if (entityIds.length > 0 && hasEntityCallback) onEntitiesSelected!(entityIds);
    }
  } else {
    // Small selection = point click, large empty selection = deselect
    const selectionWidth = Math.abs(cursor.position!.x - cursor.selectionStart!.x);
    const selectionHeight = Math.abs(cursor.position!.y - cursor.selectionStart!.y);
    const MIN_MARQUEE_SIZE = 5;
    const isSmallSelection = selectionWidth < MIN_MARQUEE_SIZE && selectionHeight < MIN_MARQUEE_SIZE;

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

function processPointClick(
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
