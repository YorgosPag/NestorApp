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
import type { CentralizedMouseHandlersProps, MouseHandlerRefs, SnapManagerAPI } from './mouse-handler-types';
// ADR-358 Phase 9D-5b-ii Sub-D — Entity type bridge for performSelection narrow.
import type { Entity } from '../../types/entities';
// ADR-065 SRP split — marquee / point-click selection processing lives in a sibling module.
import { processMarqueeSelection } from './mouse-handler-up-marquee';
// ADR-362 hotfix Round 3 (2026-05-19) — skip upstream click-snap on dim-line-offset
// pick so committed defPoints[2] matches the cursor (not a nearby entity endpoint).
// Round 1+2 gated snap only in the downstream `useDrawingHandlers.onDrawingPoint`,
// but the click world point was already snapped here BEFORE reaching that gate.
import { isDimLineRefPhase } from '../../hooks/dimensions/dim-skip-snap';
import { getActiveDragGrip } from './GripDragStore';
import { setSnapDrawingMode } from './SnapDrawingModeStore';
import { findWallFaceCornerSnap } from './wall-face-corner-snap';
import { isWallEntity, isColumnEntity } from '../../types/entities';
import {
  findColumnGripCornerSnap,
  findColumnDrawCornerSnap,
  isColumnCornerSnapGrip,
} from '../../bim/columns/column-corner-snap';
import type { ColumnGripKind } from '../../hooks/useGripMovement';
import { columnToolBridgeStore } from '../../ui/ribbon/hooks/bridge/column-tool-bridge-store';
import { resolveSnapConnectorElevationMm } from '../../bim/mep-segments/mep-snap-connector-elevation';
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
      // ADR-189 — publish drawing mode so the click `findSnapPoint` applies the same
      // intersection-only guide policy as the hover preview (Giorgio: σχεδιασμός → μόνο ✕).
      setSnapDrawingMode(isInDrawingMode(activeTool, overlayMode));
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
            // ADR-408 Φ-B1 (SSoT) — recover the connector's 3D elevation from the
            // snapped host so the segment tool can mate the endpoint in xyz. Shared
            // resolver (2D + 3D); z is resolved per host type (segment per-endpoint,
            // manifold/fixture mounting datum). Harmless to non-segment tools.
            if (scene) {
              const zMm = resolveSnapConnectorElevationMm(
                snapResult.snapPoint,
                worldPoint.x,
                worldPoint.y,
                (id) => scene.entities?.find((en) => en.id === id) as Entity | undefined,
              );
              if (zMm !== null) connectorZmm = zMm;
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
