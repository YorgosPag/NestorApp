/**
 * Aggregates all modify-tool hooks for CanvasSection.
 *
 * Each new modify command (Trim, Extend, Offset, Chamfer…) adds lines only
 * here — CanvasSection stays thin. ADR-349/350/ADR-040 patterns maintained.
 */
'use client';
import { useCallback, useEffect } from 'react';
import type React from 'react';
import { useRotationTool } from './useRotationTool';
import { useMoveTool } from './useMoveTool';
import { useMirrorTool } from './useMirrorTool';
import { useScaleTool } from './useScaleTool';
import { useStretchTool } from './useStretchTool';
import { useTrimTool } from './useTrimTool';
import { MoveOverlayCommand, MoveMultipleOverlaysCommand } from '../../core/commands';
import { subscribeToImmediateWorldPosition } from '../../systems/cursor/ImmediatePositionStore';
import { distanceToEntity } from '../../utils/entity-distance';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import type { ICommand } from '../../core/commands/interfaces';
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas/PreviewCanvas';
import type { useLevels } from '../../systems/levels';
import type { useOverlayStore } from '../../overlays/overlay-store';
import type { useUniversalSelection } from '../../systems/selection';
import type { Overlay, UpdateOverlayData } from '../../overlays/types';
import type { PromptDialogOptions } from '../../systems/prompt-dialog/prompt-dialog-store';

type LevelManager = ReturnType<typeof useLevels>;
type OverlayStore = ReturnType<typeof useOverlayStore>;
type UniversalSelection = ReturnType<typeof useUniversalSelection>;

export interface UseModifyToolsProps {
  activeTool: string;
  selectedEntityIds: string[];
  levelManager: LevelManager;
  executeCommand: (cmd: ICommand) => void;
  onToolChange: ((tool: string) => void) | undefined;
  previewCanvasRef: React.RefObject<PreviewCanvasHandle | null>;
  transformScale: number;
  overlayStore: OverlayStore;
  universalSelection: UniversalSelection;
  currentOverlays: Overlay[];
  overlayUpdate: (id: string, patch: UpdateOverlayData) => void;
  showPromptDialog: (opts: PromptDialogOptions) => Promise<string | null>;
  t: (key: string) => string;
}

export function useModifyTools({
  activeTool,
  selectedEntityIds,
  levelManager,
  executeCommand,
  onToolChange,
  previewCanvasRef,
  transformScale,
  overlayStore,
  universalSelection,
  currentOverlays,
  overlayUpdate,
  showPromptDialog,
  t,
}: UseModifyToolsProps) {
  const rotationTool = useRotationTool({
    activeTool, selectedEntityIds, levelManager, executeCommand, previewCanvasRef,
    onToolChange, currentOverlays, overlayUpdate,
  });

  const mirrorTool = useMirrorTool({
    activeTool, selectedEntityIds, levelManager, executeCommand, previewCanvasRef, onToolChange,
  });

  const scaleTool = useScaleTool({
    activeTool, selectedEntityIds, levelManager, executeCommand, previewCanvasRef, onToolChange,
  });

  const stretchTool = useStretchTool({
    activeTool, selectedEntityIds, levelManager, executeCommand, onToolChange,
  });

  const trimHitTest = useCallback((worldPoint: { x: number; y: number }): string | null => {
    if (!levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene?.entities) return null;
    const tol = TOLERANCE_CONFIG.SNAP_DEFAULT / transformScale;
    let best: { id: string; d: number } | null = null;
    for (const e of scene.entities) {
      const d = distanceToEntity(worldPoint, e, tol);
      if (d === null || d > tol) continue;
      if (!best || d < best.d) best = { id: e.id, d };
    }
    return best?.id ?? null;
  }, [levelManager, transformScale]);

  const trimTool = useTrimTool({
    activeTool, levelManager, executeCommand, hitTestEntity: trimHitTest, onToolChange,
  });

  const executeOverlayMove = useCallback(
    (ids: string[], delta: { x: number; y: number }) => {
      executeCommand(
        ids.length === 1
          ? new MoveOverlayCommand(ids[0], delta, overlayStore, false)
          : new MoveMultipleOverlaysCommand(ids, delta, overlayStore, false),
      );
    },
    [overlayStore, executeCommand],
  );

  const createOverlayMoveCommand = useCallback(
    (ids: string[], delta: { x: number; y: number }) =>
      ids.length === 1
        ? new MoveOverlayCommand(ids[0], delta, overlayStore, false)
        : new MoveMultipleOverlaysCommand(ids, delta, overlayStore, false),
    [overlayStore],
  );

  const moveTool = useMoveTool({
    activeTool, selectedEntityIds,
    selectedOverlayIds: universalSelection.getIdsByType('overlay'),
    levelManager, executeCommand, previewCanvasRef,
    executeOverlayMove, createOverlayMoveCommand, onToolChange,
  });

  const handleRotationAnglePrompt = useCallback(async () => {
    const result = await showPromptDialog({
      title: t('promptDialog.rotationAngle'),
      label: t('promptDialog.enterAngle'),
      placeholder: t('promptDialog.anglePlaceholder'),
      inputType: 'number',
      unit: '°',
      validate: (val) => {
        const n = parseFloat(val);
        if (isNaN(n)) return t('promptDialog.invalidNumber');
        return null;
      },
    });
    if (result !== null) {
      const angle = parseFloat(result);
      if (!isNaN(angle) && Math.abs(angle) > 0.001) rotationTool.handleAngleInput(angle);
    }
  }, [showPromptDialog, t, rotationTool]);

  useEffect(() => {
    if (!rotationTool.isActive) return;
    return subscribeToImmediateWorldPosition((pos) => {
      if (pos) rotationTool.handleRotationMouseMove(pos);
    });
  }, [rotationTool.isActive, rotationTool.handleRotationMouseMove]);

  return {
    rotationTool,
    moveTool,
    mirrorTool,
    scaleTool,
    stretchTool,
    trimTool,
    handleRotationAnglePrompt,
  };
}

export type UseModifyToolsReturn = ReturnType<typeof useModifyTools>;
