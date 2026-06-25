/**
 * USE BIM COPY TOOL — ADR-363 R1
 *
 * AutoCAD COPY pattern for BIM entities:
 *   idle → awaiting-base-point (on activate with BIM selection)
 *        → awaiting-target-point (after base click)
 *        → execute BimCopyCommand(translate delta) → loop (continuous)
 *        → ESC → select mode
 *
 * Non-BIM entities in the selection are silently skipped by BimCopyCommand.
 * If no BIM entities exist in selection → tool reverts to 'select' immediately.
 *
 * @see bim/transforms/bim-copy-builder.ts — pure clone SSoT
 * @see core/commands/entity-commands/BimCopyCommand.ts — ICommand wrapper
 */
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import i18next from 'i18next';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { BimCopyCommand } from '../../core/commands/entity-commands/BimCopyCommand';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import type { useLevels } from '../../systems/levels';

// ── Constants ─────────────────────────────────────────────────────────────────

/** BIM entity types supported by BimCopyCommand (mirrors bim-copy-builder ID_GENERATORS). */
const BIM_COPY_TYPES = new Set([
  'wall', 'opening', 'slab', 'slab-opening', 'column', 'beam', 'stair',
]);

// ── Types ─────────────────────────────────────────────────────────────────────

export type BimCopyPhase = 'idle' | 'awaiting-base-point' | 'awaiting-target-point';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseBimCopyToolProps {
  activeTool: string;
  selectedEntityIds: string[];
  levelManager: LevelManagerLike;
  executeCommand: (cmd: ICommand) => void;
  onToolChange?: (tool: string) => void;
}

export interface UseBimCopyToolReturn {
  isActive: boolean;
  phase: BimCopyPhase;
  handleBimCopyClick: (worldPoint: Point2D) => void;
  handleBimCopyEscape: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useBimCopyTool({
  activeTool,
  selectedEntityIds,
  levelManager,
  executeCommand,
  onToolChange,
}: UseBimCopyToolProps): UseBimCopyToolReturn {
  const isActive = activeTool === 'bim-copy';

  const [phase, setPhase] = useState<BimCopyPhase>('idle');
  const [basePoint, setBasePoint] = useState<Point2D | null>(null);

  /** Snapshot of BIM entity IDs captured on activation — stable throughout the copy session. */
  const bimIdsRef = useRef<string[]>([]);
  const wasActiveRef = useRef(false);

  const getSceneManager = useCallback(() => {
    if (!levelManager.currentLevelId) return null;
    return createLevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
  }, [levelManager]);

  // ── State machine: activate / deactivate ─────────────────────────────────

  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      const scene = levelManager.currentLevelId
        ? levelManager.getLevelScene(levelManager.currentLevelId)
        : null;

      const bimIds = selectedEntityIds.filter((id) => {
        const entity = scene?.entities.find((x) => x.id === id);
        return entity ? BIM_COPY_TYPES.has(entity.type) : false;
      });

      bimIdsRef.current = bimIds;

      if (bimIds.length === 0) {
        // No BIM entities selected → revert immediately
        onToolChange?.('select');
      } else {
        setPhase('awaiting-base-point');
        setBasePoint(null);
      }
    } else if (!isActive && wasActiveRef.current) {
      setPhase('idle');
      setBasePoint(null);
      bimIdsRef.current = [];
    }

    wasActiveRef.current = isActive;
  }, [isActive, selectedEntityIds, levelManager, onToolChange]);

  // ── Click: base point → target point → execute (continuous loop) ─────────

  const handleBimCopyClick = useCallback((worldPoint: Point2D): void => {
    if (!isActive) return;

    if (phase === 'awaiting-base-point') {
      setBasePoint(worldPoint);
      setPhase('awaiting-target-point');
      return;
    }

    if (phase === 'awaiting-target-point' && basePoint) {
      const sm = getSceneManager();
      if (!sm) return;
      const delta: Point2D = {
        x: worldPoint.x - basePoint.x,
        y: worldPoint.y - basePoint.y,
      };
      const cmd = new BimCopyCommand(
        bimIdsRef.current,
        { kind: 'translate', delta },
        sm,
      );
      executeCommand(cmd);
      // Continuous: keep base point, loop for next target
    }
  }, [isActive, phase, basePoint, getSceneManager, executeCommand]);

  // ── Escape: exit to select ────────────────────────────────────────────────

  const handleBimCopyEscape = useCallback((): void => {
    setPhase('idle');
    setBasePoint(null);
    bimIdsRef.current = [];
    onToolChange?.('select');
  }, [onToolChange]);

  // ── Tool hint override ────────────────────────────────────────────────────

  useEffect(() => {
    if (!isActive || phase === 'idle') {
      toolHintOverrideStore.setOverride(null);
      return;
    }
    const key = phase === 'awaiting-base-point'
      ? 'dxf-viewer-guides:bimCopyTool.selectBasePoint'
      : 'dxf-viewer-guides:bimCopyTool.selectTargetPoint';
    toolHintOverrideStore.setOverride(i18next.t(key));
    return () => { toolHintOverrideStore.setOverride(null); };
  }, [isActive, phase]);

  return { isActive, phase, handleBimCopyClick, handleBimCopyEscape };
}
