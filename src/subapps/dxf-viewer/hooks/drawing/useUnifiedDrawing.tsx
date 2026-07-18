/**
 * @module useUnifiedDrawing
 * @description Unified drawing system hook that combines entity creation with measurement-style interaction.
 * Provides a consistent interface for all drawing tools with snap integration and preview support.
 *
 * @example
 * ```tsx
 * const drawing = useUnifiedDrawing();
 *
 * // Start drawing a line
 * drawing.setTool('line');
 *
 * // Add points (with snap support)
 * drawing.addPoint({ x: 100, y: 100 });
 * drawing.addPoint({ x: 200, y: 200 });
 *
 * // Finish and get the created entity
 * const entity = drawing.finishDrawing();
 * ```
 *
 * @returns {Object} Drawing state and control methods
 * @returns {DrawingState} state - Current drawing state
 * @returns {Function} setTool - Set the active drawing tool
 * @returns {Function} addPoint - Add a point to the current drawing
 * @returns {Function} updatePreview - Update preview with mouse position
 * @returns {Function} finishDrawing - Complete the current drawing
 * @returns {Function} cancelDrawing - Cancel the current drawing
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import { useDrawingMachine } from '../../core/state-machine';
import { getToolMetadata } from '../../systems/tools/ToolStateManager';
import type { ToolType } from '../../ui/toolbar/types';
// Re-export types for backward compatibility (19 consumer files import from here)
export type {
  PreviewPoint,
  PreviewText,
  ExtendedPolylineEntity,
  ExtendedCircleEntity,
  ExtendedLineEntity,
  ExtendedArcEntity,
  ExtendedSceneEntity,
  DrawingTool,
  DrawingState,
} from './drawing-types';
import type { DrawingTool, ExtendedSceneEntity, DrawingState } from './drawing-types';
import type { Entity } from '../../types/entities';
import { useLevels, useCurrentLevelScene } from '../../systems/levels';
import { usePreviewMode } from '../usePreviewMode';
import { useLineStyles } from '../../settings-provider';
import { completeEntity } from './completeEntity';
// ADR-507 §5δ.9 — post-create send-to-back command builder για τη γραμμοσκίαση.
import { buildHatchPostCreateCommands } from '../../bim/hatch/hatch-completion';
import { createEntityFromTool as createEntityFromToolPure, isEntityComplete } from './drawing-entity-builders';
import { generatePreviewEntity, applyPreviewStyling, createPartialPreview } from './drawing-preview-generator';
import { generateWallOnEntityPreview } from './wall-on-entity-preview';
// Per-BIM-tool preview point reconstruction (stair/wall/slab/roof/beam), extracted to
// keep this hook under the 500-line cap (N.7.1). Each tool's preview SSoT lives behind it.
import { resolveBimToolTempPoints } from './drawing-preview-tool-points';
import { toolStateStore } from '../../stores/ToolStateStore';
import { resolveSceneUnits } from '../../utils/scene-units';
import { applyPreviewSettingsToEntity } from './apply-preview-settings';
// ADR-578 — SSoT crypto-unique entity id (ADR-065). Replaces the legacy per-hook
// `useRef(1)` counter that minted reusable `entity_${n}` ids and produced scene
// duplicate-id corruption (`entity_8` ×2) across remounts / multiple hook instances.
import { generateEntityId } from '../../systems/entity-creation/utils';
// Pure tool-classification helpers extracted to keep this hook under the
// 500-line cap (N.7.1): tool sets + effective level-id + duplicate-endpoint cleanup.
import {
  getEffectiveLevelId,
  removeDuplicateEndPoint,
} from './drawing-tool-classification';

export function useUnifiedDrawing() {
  const {
    context: machineContext,
    isDrawing: machineIsDrawing,
    canAddPoint,
    selectTool: machineSelectTool,
    deselectTool: machineDeselectTool,
    addPoint: machineAddPoint,
    undoPoint: machineUndoPoint,
    complete: machineComplete,
    cancel: machineCancel,
    reset: machineReset,
  } = useDrawingMachine({ useGlobal: true });

  const [localState, setLocalState] = useState<{
    previewEntity: ExtendedSceneEntity | null;
    isOverlayMode: boolean;
  }>({
    previewEntity: null,
    isOverlayMode: false,
  });

  // Sync ref for PreviewCanvas zero-latency rendering (bypasses React batching)
  const previewEntityRef = useRef<ExtendedSceneEntity | null>(null);
  // Entity IDs from continuous measurement session (for "Undo All")
  const continuousSessionEntityIdsRef = useRef<string[]>([]);
  // Arc direction toggle (X key / context menu)
  const arcFlippedRef = useRef<boolean>(false);

  const state: DrawingState = useMemo(() => ({
    currentTool: (machineContext.toolType as DrawingTool) || 'select',
    isDrawing: machineIsDrawing,
    previewEntity: localState.previewEntity,
    tempPoints: machineContext.points as Point2D[],
    isOverlayMode: localState.isOverlayMode,
    currentPoints: machineContext.points as Point2D[],
    snapPoint: machineContext.snapInfo.snapPoint,
    snapType: machineContext.snapInfo.snapType,
  }), [machineContext, machineIsDrawing, localState]);

  const {
    currentLevelId,
    getLevelScene,
    setLevelScene
  } = useLevels();
  // ADR-557 — SSoT for the live current-level scene (replaces the hand-copied
  // `currentLevelId ? getLevelScene(currentLevelId) ?? null : null` derivation below).
  const liveScene = useCurrentLevelScene();

  const { setMode } = usePreviewMode();
  const linePreviewStyles = useLineStyles('preview');

  /**
   * Applies ColorPalettePanel preview settings to an entity (ADR-358 §G7
   * Phase 6.5). Sentinel-aware projection lives in `apply-preview-settings.ts`
   * so it stays unit-testable in isolation.
   */
  const applyPreviewSettings = useCallback((entity: Record<string, unknown>) => {
    applyPreviewSettingsToEntity(entity, linePreviewStyles);
  }, [linePreviewStyles]);

  const createEntityFromTool = useCallback((tool: DrawingTool, points: Point2D[]): Entity | null => {
    // ADR-578 — crypto-unique id from the enterprise SSoT (ADR-065), minted here so
    // the id is known before `completeEntity`/`CreateEntityCommand` execute (preserves
    // the ADR-507 §5δ.9 post-create compound-command contract that needs a stable id
    // up front). Guarantees global uniqueness across hook instances and remounts.
    const id = generateEntityId();
    return createEntityFromToolPure(tool, points, id, arcFlippedRef.current);
  }, []);

  /**
   * Add a point to the current drawing.
   * @returns true if the drawing was completed (entity created and added to scene)
   */
  const addPoint = useCallback((worldPoint: Point2D, _transform: { worldToScreen: (point: Point2D) => Point2D; screenToWorld: (point: Point2D) => Point2D }): boolean => {
    if (!canAddPoint) return false;

    machineAddPoint(worldPoint);
    const newTempPoints = [...machineContext.points, worldPoint];
    const currentTool = (machineContext.toolType as DrawingTool) || 'select';

    // ── Continuous measurement: create entity every 2 points, keep last ──
    if (currentTool === 'measure-distance-continuous' && newTempPoints.length >= 2 && newTempPoints.length % 2 === 0) {
      const lastTwoPoints = newTempPoints.slice(-2);
      completeEntity(createEntityFromTool('measure-distance', lastTwoPoints), {
        tool: currentTool as ToolType,
        levelId: currentLevelId || '0',
        getScene: getLevelScene,
        setScene: setLevelScene,
        trackForUndo: (id) => continuousSessionEntityIdsRef.current.push(id),
        skipToolPersistence: true,
      });

      // Keep last point for next segment (AutoCAD MEASUREGEOM pattern)
      machineReset();
      machineSelectTool(currentTool);
      machineAddPoint(newTempPoints[newTempPoints.length - 1]);

      const nextPreview = createEntityFromTool(currentTool, [newTempPoints[newTempPoints.length - 1]]);
      if (nextPreview) {
        // ADR-663 §4 part 4 — ο builder επιστρέφει πλέον `Entity`, που ΕΙΝΑΙ μέλος του
        // `ExtendedSceneEntity` union → η ανάθεση στέκει χωρίς cast.
        previewEntityRef.current = nextPreview;
      }
      return false;
    }

    // ── Entity completion ────────────────────────────────────────────────
    if (isEntityComplete(currentTool, newTempPoints.length)) {
      const meta = getToolMetadata(currentTool as ToolType);
      const newEntity = createEntityFromTool(currentTool, newTempPoints);
      const effectiveLevelId = getEffectiveLevelId(currentTool, currentLevelId);

      if (newEntity && effectiveLevelId) {
        previewEntityRef.current = null;
        completeEntity(newEntity, {
          tool: currentTool as ToolType,
          levelId: effectiveLevelId,
          getScene: getLevelScene,
          setScene: setLevelScene,
        });
      }

      // ADR-357 Phase 5 G5: Chain mode — seed next segment from last endpoint.
      // Same pattern as measure-distance-continuous; returns false so onDrawingPoint
      // emits canvas-click (DynamicInput anchor resets to new chain start) and does
      // NOT clear TrackingPoints (per spec: tracking persists between chain segments).
      if (meta.allowsChain) {
        const lastEndPoint = newTempPoints[newTempPoints.length - 1];
        machineReset();
        machineSelectTool(currentTool);
        machineAddPoint(lastEndPoint);
        setLocalState(prev => ({ ...prev, previewEntity: null }));
        return false;
      }

      setMode('normal');
      machineComplete();
      machineReset();

      // Re-select for continuous tools, deselect for one-shot tools
      if (meta.allowsContinuous) {
        machineSelectTool(currentTool);
      } else {
        machineDeselectTool();
      }

      setLocalState(prev => ({ ...prev, previewEntity: null }));
      return true;
    }

    // ── Not yet complete — show partial preview ──────────────────────────
    const partialPreview = createPartialPreview(currentTool, newTempPoints);
    setLocalState(prev => ({ ...prev, previewEntity: partialPreview }));
    return false;
  }, [canAddPoint, machineAddPoint, machineContext.points, machineContext.toolType, createEntityFromTool, currentLevelId, getLevelScene, setLevelScene, setMode, machineComplete, machineReset, machineDeselectTool]);

  const updatePreview = useCallback((mousePoint: Point2D, _transform: { worldToScreen: (point: Point2D) => Point2D; screenToWorld: (point: Point2D) => Point2D }) => {
    const machineTool = (machineContext.toolType as DrawingTool) || 'select';
    // ADR-358 Phase 8 preview hotfix — stair tool runs its own state machine
    // outside `machineContext.points`. `useToolbarState.handleToolChange` does
    // NOT route `'stair'` through `onDrawingStart`, so `machineTool` stays at
    // `'select'` even when the stair tool is active. Source the authoritative
    // active tool from the SSoT `toolStateStore` so the preview surfaces.
    const activeTool = toolStateStore.get().activeTool;
    const isStair = activeTool === 'stair';
    // ADR-363 Phase 1C — wall tool runs its own state machine (mirror stair),
    // so `machineTool` stays at `'select'`. Resolve via toolStateStore SSoT.
    const isWall = activeTool === 'wall';
    const isSlab = activeTool === 'slab';
    const isBeam = activeTool === 'beam';
    const isRoof = activeTool === 'roof';
    // ADR-398 §3.8 — column tool runs its own single-click FSM (mirror beam),
    // so `machineTool` stays 'select'. Route it through the WYSIWYG preview path.
    const isColumn = activeTool === 'column';
    // ADR-514 Φ6c — foundation pad runs its own single-click FSM (mirror column), so `machineTool`
    // stays 'select'. Route it through the WYSIWYG preview path → live face-snapped pad ghost.
    const isFoundationPad = activeTool === 'foundation-pad';
    // ADR-652 §M7 — block-library placement τρέχει δικό του single-click FSM (mirror column/
    // foundation-pad): το `machineTool` μένει 'select'. Route μέσω του WYSIWYG preview path →
    // ζωντανό block ghost + ενδείξεις τοποθέτησης (λευκά ίχνη + κυανές + ΜΗΚΟΣ/ΓΩΝΙΑ + ΤΟΞΟ ΦΟΡΑΣ).
    const isBlockLibrary = activeTool === 'block-library';
    // ADR-363 Phase 1J — «Τοίχος πάνω σε οντότητα»: δικό του single-entity preview (γραμμή →
    // φάντασμα τοίχου, side = live cursor). Στυλίζεται ως 'wall' (WYSIWYG member ghost).
    const isWallOnEntity = activeTool === 'wall-on-entity';
    // ADR-508 §text-parity (Giorgio 2026-07-07) — «Κείμενο»/«Πολυγραμμικό Κείμενο»: single-click
    // annotation tools που ΠΑΡΑΚΑΜΠΤΟΥΝ το FSM (καμία entry στο core/state-machine/interfaces.ts →
    // `machineTool` μένει 'select'). Route μέσω του toolStateStore SSoT (mirror stair/wall/column)
    // ώστε να παραχθεί το ghost-φάντασμα + οι ενδείξεις τοποθέτησης (λευκά ίχνη + κυανές + OSNAP).
    const isText = activeTool === 'text';
    const isMText = activeTool === 'mtext';
    // ADR-619 — «Σκάλα από περιοχή»: δικό του N-click polygon FSM κρατά το `machineTool` στο
    // 'select', οπότε το route-άρουμε ως 'slab' (ΙΔΙΟ tool-agnostic rubber-band footprint outline
    // με slab/roof/hatch· τα vertices έρχονται από το `stairRegionPreviewStore` μέσω
    // `resolveBimToolTempPoints(activeTool)` — όχι από το currentTool).
    const isStairRegion = activeTool === 'stair-from-region';
    const currentTool: DrawingTool = isStair ? 'stair' : (isWall || isWallOnEntity) ? 'wall' : isSlab ? 'slab' : isBeam ? 'beam' : isRoof ? 'roof' : isColumn ? 'column' : isFoundationPad ? 'foundation-pad' : isBlockLibrary ? 'block-library' : isText ? 'text' : isMText ? 'mtext' : isStairRegion ? 'slab' : machineTool;
    if (!isStair && !isWall && !isWallOnEntity && !isSlab && !isBeam && !isRoof && !isColumn && !isFoundationPad && !isBlockLibrary && !isText && !isMText && !isStairRegion && (!machineTool || machineTool === 'select')) return;

    // machineMoveCursor intentionally removed — it updated cursorPosition in machine context
    // (never read by any component) and notified React useSyncExternalStore subscribers on
    // every mousemove → 80-102ms commits on CanvasSection + 8 children during drawing.
    // Preview entity is generated from mousePoint directly (no machine cursor read needed).
    // BIM tools (stair/wall/slab/roof/beam) run their own placement state machine and
    // store preview state in per-tool SSoT stores; reconstruct their point tuple here.
    const tempPoints = resolveBimToolTempPoints(activeTool, machineContext.points);

    // ADR-358 Phase 8 — scene units propagated to stair preview so the
    // ghost rubber-band + walkline match the host floorplan scale.
    // `resolveSceneUnits` is the SSoT (utils/scene-units): prefers the real
    // `$INSUNITS` propagated by dxf-scene-builder, falls back to bounds
    // heuristic for legacy / unitless scenes.
    const sceneUnitsForPreview = (() => {
      if (!isStair && !isWall && !isWallOnEntity && !isSlab && !isBeam && !isRoof && !isColumn && !isFoundationPad && !isBlockLibrary && !isStairRegion) return 'mm' as const;
      const levelId = currentLevelId;
      if (!levelId) return 'mm' as const;
      return resolveSceneUnits(getLevelScene(levelId));
    })();

    // ADR-363 Phase 1J — on-entity: δικός του generator (χρειάζεται scene entities + κέρσορα, που
    // ζουν εδώ μέσω `getLevelScene`)· ο `DrawingTool` τύπος δεν περιλαμβάνει το 'wall-on-entity',
    // οπότε δεν περνά από το `generatePreviewEntity`.
    const previewEntity = isWallOnEntity
      ? generateWallOnEntityPreview(
          mousePoint,
          liveScene?.entities ?? [],
          sceneUnitsForPreview,
        )
      : generatePreviewEntity(
          currentTool,
          tempPoints,
          mousePoint,
          arcFlippedRef.current,
          createEntityFromTool,
          sceneUnitsForPreview,
        );
    if (previewEntity) {
      applyPreviewStyling(
        previewEntity, currentTool,
        [...tempPoints, mousePoint], mousePoint,
        localState.isOverlayMode === true, applyPreviewSettings
      );
    }

    previewEntityRef.current = previewEntity;
  }, [machineContext.toolType, machineContext.points, localState.isOverlayMode, createEntityFromTool, applyPreviewSettings, currentLevelId, getLevelScene, liveScene]);

  const startDrawing = useCallback((tool: DrawingTool) => {
    setMode('preview');
    if (tool === 'measure-distance-continuous') {
      continuousSessionEntityIdsRef.current = [];
    }
    arcFlippedRef.current = false;
    machineSelectTool(tool);
    setLocalState({ previewEntity: null, isOverlayMode: false });
  }, [setMode, machineSelectTool]);

  const cancelDrawing = useCallback(() => {
    setMode('normal');
    continuousSessionEntityIdsRef.current = [];
    machineCancel('User cancelled drawing');
    machineReset();
    machineDeselectTool();
    previewEntityRef.current = null;
    setLocalState(prev => ({ ...prev, previewEntity: null }));
  }, [setMode, machineCancel, machineReset, machineDeselectTool]);

  /** Undo: for continuous measurement deletes ALL session entities, otherwise removes last point */
  const undoLastPoint = useCallback(() => {
    const currentTool = (machineContext.toolType as DrawingTool) || 'select';

    // Continuous measurement: undo = delete ALL session entities
    if (currentTool === 'measure-distance-continuous') {
      const sessionEntityIds = continuousSessionEntityIdsRef.current;
      if (sessionEntityIds.length > 0) {
        const effectiveLevelId = currentLevelId || '0';
        const scene = getLevelScene(effectiveLevelId);
        if (scene) {
          const updatedEntities = scene.entities.filter(
            entity => !sessionEntityIds.includes(entity.id)
          );
          setLevelScene(effectiveLevelId, { ...scene, entities: updatedEntities });
        }
        continuousSessionEntityIdsRef.current = [];
      }
      machineCancel();
      machineReset();
      setMode('normal');
      previewEntityRef.current = null;
      setLocalState(prev => ({ ...prev, previewEntity: null }));
      return;
    }

    // Standard undo: remove last point, preview updates on next mouse move
    machineUndoPoint();
    previewEntityRef.current = null;
    setLocalState(prev => ({ ...prev, previewEntity: null }));
  }, [machineContext.toolType, machineUndoPoint, machineCancel, machineReset, setMode, currentLevelId, getLevelScene, setLevelScene]);

  /** Toggle arc direction (AutoCAD X command) */
  const flipArcDirection = useCallback(() => {
    const currentTool = (machineContext.toolType as DrawingTool) || 'select';
    if (currentTool === 'arc-3p' || currentTool === 'arc-cse' || currentTool === 'arc-sce') {
      arcFlippedRef.current = !arcFlippedRef.current;
    }
  }, [machineContext.toolType]);

  const finishPolyline = useCallback(() => {
    const currentTool = (machineContext.toolType as DrawingTool) || 'select';
    const cleanedPoints = removeDuplicateEndPoint(machineContext.points);

    // Circle best-fit: minimum 3 points (ADR-083)
    if (currentTool === 'circle-best-fit' && cleanedPoints.length >= 3) {
      const newEntity = createEntityFromTool(currentTool, cleanedPoints);
      if (newEntity) {
        completeEntity(newEntity, {
          tool: currentTool as ToolType,
          levelId: currentLevelId || '0',
          getScene: getLevelScene,
          setScene: setLevelScene,
        });
        setMode('normal');
        cancelDrawing();
        return newEntity;
      }
      return null;
    }

    // Polyline, polygon, measure-angle variants, measure-area: minimum 2 points
    const isFinishable =
      currentTool === 'polyline' || currentTool === 'measure-angle' ||
      currentTool === 'measure-angle-measuregeom' ||
      currentTool === 'polygon' || currentTool === 'measure-area' ||
      currentTool === 'hatch'; // ADR-507 S2 — κλειστό όριο γραμμοσκίασης

    if (isFinishable && cleanedPoints.length >= 2) {
      const newEntity = createEntityFromTool(currentTool, cleanedPoints);
      completeEntity(newEntity, {
        tool: currentTool as ToolType,
        levelId: currentLevelId || '0',
        getScene: getLevelScene,
        setScene: setLevelScene,
        // ADR-507 §5δ.9 — auto-send-to-back: create + reorder σε ΕΝΑ undo.
        ...(currentTool === 'hatch' ? { postCreateCommands: buildHatchPostCreateCommands } : {}),
      });
      setMode('normal');
      cancelDrawing();
      return newEntity;
    }

    return null;
  }, [machineContext.toolType, machineContext.points, createEntityFromTool, currentLevelId, getLevelScene, setLevelScene, cancelDrawing, setMode]);

  // Shared stop-handle for the free-sketch starters (polyline/polygon): snapshot the
  // machine points, reset mode, run any per-tool cleanup, cancel, then fire onComplete
  // (>=3 pts) / onCancel. Owns the flow both starters inlined identically (N.18).
  const buildSketchStop = useCallback((
    options: { onComplete?: (points: Point2D[]) => void; onCancel?: () => void },
    cleanup?: () => void,
  ) => () => {
    const points = [...machineContext.points];
    setMode('normal');
    cleanup?.();
    cancelDrawing();
    if (options.onComplete && points.length >= 3) {
      options.onComplete(points);
    } else if (options.onCancel) {
      options.onCancel();
    }
  }, [machineContext.points, setMode, cancelDrawing]);

  const startPolyline = useCallback((options: { onComplete?: (points: Point2D[]) => void; onCancel?: () => void } = {}) => {
    startDrawing('polyline');
    return { stop: buildSketchStop(options) };
  }, [startDrawing, buildSketchStop]);

  const startPolygon = useCallback((options: { onComplete?: (points: Point2D[]) => void; onCancel?: () => void; isOverlay?: boolean } = {}) => {
    setLocalState(prev => ({ ...prev, isOverlayMode: options.isOverlay || false }));
    startDrawing('polygon');
    return { stop: buildSketchStop(options, () => setLocalState(prev => ({ ...prev, isOverlayMode: false }))) };
  }, [startDrawing, buildSketchStop]);

  const getLatestPreviewEntity = useCallback(() => previewEntityRef.current, []);

  return {
    state,
    addPoint,
    updatePreview,
    startDrawing,
    cancelDrawing,
    undoLastPoint,
    flipArcDirection,
    finishEntity: finishPolyline,
    finishPolyline,
    startPolyline,
    startPolygon,
    setTool: startDrawing,
    finishDrawing: finishPolyline,
    snapConfig: null,
    getLatestPreviewEntity,
  };
}
