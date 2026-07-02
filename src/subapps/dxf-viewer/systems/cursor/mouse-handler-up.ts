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
import { GripAltMoveStore } from '../grip/GripAltMoveStore';
import { setSnapDrawingMode } from './SnapDrawingModeStore';
import { findWallFaceCornerSnap } from '../../bim/walls/wall-face-corner-snap';
import { isWallEntity, isColumnEntity } from '../../types/entities';
import {
  findColumnGripCornerSnap,
  isColumnCornerSnapGrip,
} from '../../bim/columns/column-corner-snap';
import { resolveBimCursorSnap } from '../../bim/placement/bim-cursor-snap';
import { buildColumnPolarSnapOptions } from '../../bim/columns/column-polar-opts';
import { resolveColumnHeadReferences } from '../../hooks/drawing/column-completion';
import { sceneSnapTargetsStore } from '../../bim/framing/scene-snap-targets';
import { resolveEffectivePreviewCursor } from '../../hooks/drawing/wysiwyg-preview-shared';
import { applyBimDrawingConstraint } from '../../hooks/drawing/bim-ortho-reference';
import { worldPerPixel } from '../../rendering/utils/viewport-scale';
import { getImmediateTransform } from './ImmediateTransformStore';
import { setColumnFaceAnchor, setColumnGhostStatus, setColumnFaceRotation, setColumnFaceSizing } from './ColumnPlacementGhostStatusStore';
import type { ColumnGripKind } from '../../hooks/useGripMovement';
import { columnToolBridgeStore } from '../../ui/ribbon/hooks/bridge/column-tool-bridge-store';
import { resolveSnapConnectorElevationMm } from '../../bim/mep-segments/mep-snap-connector-elevation';
import { LassoStore, computeLassoMode } from './LassoStore';
import { ZoomWindowStore } from '../zoom-window/ZoomWindowStore';
// ADR-455 — on-canvas X/Y section-cut handle drag.
import { isAxisCutDragging, endAxisCutDrag } from '../axis-cut/axis-cut-drag-store';
// ADR-507 — «Επιλογή γραμμοσκίασης»: armed hatch-only pick (even-odd SSoT, world-coords).
import { isHatchSelectArmed, runArmedHatchPick } from '../../bim/hatch/hatch-select-mode-store';
// Body-drag (grab body → move; Ctrl+drag → copy) — commit on mouseup.
import { EntityBodyDragStore } from '../drag/EntityBodyDragStore';
import { applyOrthoToDelta } from '../../bim/grips/grip-move-constraints';

/** Min pointer travel (px) before a body-drag counts as a drag (else it's a click). */
const BODY_DRAG_MIN_PX = 3;

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

    // ADR-455 — finish a section-cut handle drag; consume the up, skip select/click.
    if (isAxisCutDragging()) {
      endAxisCutDrag();
      return;
    }

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

    // Body-drag commit (grab body → MOVE; Ctrl+drag → COPY). Runs after pan
    // cleanup and BEFORE grip/hatch/click so it owns the gesture it armed at
    // mousedown. A near-zero displacement is treated as a plain click (clear +
    // fall through to the selection pipeline below); a real drag emits the
    // commit (consumed by useEntityBodyDragCommit) and consumes the mouseup.
    if (EntityBodyDragStore.getActive() && e.button === 0 && !wasPanning) {
      const session = EntityBodyDragStore.getSession();
      EntityBodyDragStore.clear();
      if (session) {
        const bodySnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
        if (bodySnap) {
          const upWorld = screenToWorldWithSnapshot(getScreenPosFromEvent(e, bodySnap), transform, bodySnap);
          // ORTHO (F8) parity with the live ghost (`useEntityBodyDragPreview`).
          const delta = applyOrthoToDelta({ x: upWorld.x - session.anchor.x, y: upWorld.y - session.anchor.y });
          const movedPx = Math.hypot(delta.x, delta.y) * transform.scale;
          if (movedPx >= BODY_DRAG_MIN_PX && session.entityIds.length > 0) {
            EventBus.emit('entity-body-drag:commit', {
              entityIds: [...session.entityIds],
              delta,
              copy: session.copy,
            });
            cursor.endSelection();
            return;
          }
        }
      }
      // Near-zero → fall through to the normal click/selection pipeline below.
    }

    // ADR-507 — «Επιλογή γραμμοσκίασης» (armed): authoritative hatch-only pick. Τρέχει
    // ΠΡΙΝ από grips / drawing-click / γενικό entity-select ώστε (α) να μη σχεδιαστεί νέα
    // γραμμοσκίαση με ενεργό το hatch tool και (β) να μην «κλαπεί» από υπερκείμενες
    // γραμμές/τοίχους. Reuse του ΙΔΙΟΥ spatial-index pick SSoT με τη normal selection,
    // απλώς με `typeFilter:['hatch']` + `replaceEntitySelection` (onEntitiesSelected).
    // One-shot: disarm σε κάθε περίπτωση, consume το click.
    if (isHatchSelectArmed() && e.button === 0 && !wasPanning) {
      // Θέση κλικ ΑΠΕΥΘΕΙΑΣ από το event (ίδιο με το onCanvasClick). Pick→select→finalize
      // μέσω του ΚΟΙΝΟΥ `runArmedHatchPick` SSoT (ίδιο με το useCanvasClickHandler).
      const pickSnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
      if (pickSnap && scene && onEntitiesSelected) {
        const wp = screenToWorldWithSnapshot(getScreenPosFromEvent(e, pickSnap), transform, pickSnap);
        runArmedHatchPick(wp, (scene.entities ?? []) as unknown as Entity[], onEntitiesSelected);
      }
      return; // πάντα consume — ΠΟΤΕ δημιουργία/grip/select όσο armed
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
          // ADR-363 Φ1G.5 — same Alt whole-entity-move path as the move handler:
          // the grabbed grip is only a base point (`column-center` is hidden), so
          // the projection must run for any kind (rotation handle included).
          const columnAltMove = GripAltMoveStore.getActive();
          if (
            activeDragGrip &&
            activeDragGrip.dragAnchor &&
            scene &&
            (columnAltMove || isColumnCornerSnapGrip(activeDragGrip.gripKind))
          ) {
            const draggedColumn = scene.entities?.find(en => en.id === activeDragGrip.entityId) as unknown as import('../../types/entities').Entity | undefined;
            if (draggedColumn && isColumnEntity(draggedColumn)) {
              const cornerSnap = findColumnGripCornerSnap(
                draggedColumn,
                activeDragGrip.gripKind as ColumnGripKind,
                activeDragGrip.dragAnchor,
                rawUpWorldPos,
                findSnapPoint,
                columnAltMove,
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
        // ADR-514 Φ2 — «Ένας Εγκέφαλος Έλξης»: το commit καλεί τον ΕΝΑ unified resolver
        // (`resolveBimCursorSnap`, toolKind:'column') αντί για τον column-specific resolver απευθείας.
        // ΙΔΙΟ σημείο εισόδου με το preview (`generateColumnPreview`) → preview ≡ commit by construction.
        // Ο εγκέφαλος delegate-άρει στον ΙΔΙΟ `resolveColumnFaceSnapFromTargets` + ΙΔΙΟΙ pre-collected
        // στόχοι (`sceneSnapTargetsStore`) + ΙΔΙΟΣ effective cursor (`resolveEffectivePreviewCursor` =
        // ImmediateSnap = ό,τι έδειξε ο scheduler: corner-projection / BIM χαρακτηριστικό / grid).
        // ⚠️ ADR-514 §2 — ο effectiveCursor είναι ΗΔΗ OSNAP-snapped κεντρικά εδώ → ΧΩΡΙΣ findSnapPoint
        // ώστε ο εγκέφαλος να ΜΗΝ ξανα-snapάρει (double-snap). Set & την auto λαβή/status που διαβάζει
        // το `useColumnTool` (center-anchor όταν status==='beam').
        const colHandle = activeTool === 'column' ? columnToolBridgeStore.get() : null;
        if (colHandle?.isActive) {
          // ADR-363 §column-ortho — ΟΡΘΟ(F8)/POLAR(F10)/step(F9+Q) ΜΕΤΑ το OSNAP, ώστε το directional
          // lock να ΥΠΕΡΙΣΧΥΕΙ της έλξης — ΙΔΙΑ σειρά με το preview (`generateColumnPreview`: OSNAP →
          // constraint → face-snap) → preview ≡ commit. No-op πριν την 1η κολόνα ή στη rotation phase.
          const snappedCursor = resolveEffectivePreviewCursor(worldPoint);
          const effectiveCursor = applyBimDrawingConstraint('column', snappedCursor, worldPerPixel(getImmediateTransform().scale));
          // ADR-398 §3.13 — Polar Magnet opts (ίδια με το ghost → preview ≡ commit).
          // §3.19 — `colHandle.kind` → circle radius (tangent candidates μόνο σε κυκλική).
          const polarOpts = buildColumnPolarSnapOptions(colHandle.overrides, colHandle.getSceneUnits(), colHandle.kind);
          const snap = resolveBimCursorSnap({
            toolKind: 'column',
            cursor: effectiveCursor,
            targets: sceneSnapTargetsStore.get(),
            sceneUnits: colHandle.getSceneUnits(),
            columnOpts: polarOpts,
            // ADR-523 — Τ-κεφαλή multi-reference (ίδιες refs με το ghost → preview ≡ commit).
            columnHead: resolveColumnHeadReferences(colHandle.kind, colHandle.overrides, colHandle.getSceneUnits()),
            lShapeGhost: colHandle.kind === 'L-shape', // ADR-525 — corner-gap auto-junction tier
          });
          if (snap.kind === 'column-placement') {
            worldPoint = snap.placement.position;
            setColumnFaceAnchor(snap.placement.anchor);
            setColumnFaceRotation(snap.placement.rotation); // §3.10b flush-to-edge γωνία (0 axis-aligned)
            setColumnGhostStatus(snap.placement.status);
            setColumnFaceSizing(snap.placement.sizing ?? null); // ADR-525 — L auto-διαστασιολόγηση (single-click)
          } else {
            setColumnFaceAnchor(null);
            setColumnFaceRotation(null);
            setColumnGhostStatus('neutral');
            setColumnFaceSizing(null);
            worldPoint = snap.point; // effectiveCursor αυτούσιος (corner/grid-adjusted) — όπως το ghost
          }
        } else if (activeTool === 'beam') {
          // preview ≡ commit (ADR-514 §2 / Giorgio 2026-06-25) — το beam tool, ΟΠΩΣ το column,
          // ΔΕΝ κάνει `findSnapPoint` εδώ (double-snap): ο `resolveStartAnchor` (use-beam-commit)
          // καλεί τον ΙΔΙΟ `resolveBimCursorSnap` με τον effectiveCursor (ImmediateSnap = ό,τι έδειξε
          // ο scheduler/ghost — corner-projection / BIM χαρακτηριστικό / grid). Με το `findSnapPoint`
          // το commit ΞΑΝΑ-snapάριζε σε διαφορετικό σημείο (π.χ. παρειά γειτονικής κολόνας) → ο cursor
          // άλλαζε μέλος/third στο `spanJustification` → το justified auto-span (north-flush) έβγαινε
          // **centered** (preview≠commit). Με τον ΙΔΙΟ effectiveCursor → north-flush by construction.
          worldPoint = resolveEffectivePreviewCursor(worldPoint);
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
