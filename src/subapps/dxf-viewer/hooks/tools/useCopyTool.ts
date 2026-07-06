/**
 * USE COPY TOOL — ADR-363 R1 / ADR-577 (unified interactive COPY)
 *
 * AutoCAD COPY pattern for ANY entity type (DXF geometry + BIM parametric +
 * groups). Reachable from the ribbon «Αντιγραφή» button and the C+O chord —
 * both drive `activeTool === 'copy'`.
 *
 *   idle → awaiting-base-point (on activate with a non-empty selection)
 *        → awaiting-target-point (after base click)
 *        → clone selection at (target − base) delta → loop (continuous)
 *        → ESC → select mode
 *
 * The clone itself goes through the SHARED clone SSoT `buildEntityCloneCommand`
 * — the SAME path the clipboard (Ctrl+V) and the Ctrl+drag body copy use — so
 * BIM entities get kind-specific enterprise IDs + host rewire + fresh IFC
 * GlobalId, DXF geometry gets an id-swap clone, and both persist through the one
 * `PasteEntitiesCommand` (N.0.2 — one clone path, no divergence).
 *
 * Any selected id that resolves to a live scene entity is copyable. If the
 * selection resolves to nothing → the tool reverts to 'select' immediately.
 *
 * @see bim/transforms/build-entity-clone-command.ts — unified clone SSoT (BIM + DXF)
 * @see core/commands/entity-commands/PasteEntitiesCommand.ts — undoable commit
 */
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import i18next from 'i18next';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { buildEntityCloneCommand } from '../../bim/transforms/build-entity-clone-command';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand, SceneEntity } from '../../core/commands/interfaces';
import type { useLevels } from '../../systems/levels';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CopyPhase = 'idle' | 'awaiting-base-point' | 'awaiting-target-point';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseCopyToolProps {
  activeTool: string;
  selectedEntityIds: string[];
  levelManager: LevelManagerLike;
  executeCommand: (cmd: ICommand) => void;
  onToolChange?: (tool: string) => void;
}

export interface UseCopyToolReturn {
  isActive: boolean;
  phase: CopyPhase;
  handleCopyClick: (worldPoint: Point2D) => void;
  handleCopyEscape: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCopyTool({
  activeTool,
  selectedEntityIds,
  levelManager,
  executeCommand,
  onToolChange,
}: UseCopyToolProps): UseCopyToolReturn {
  const isActive = activeTool === 'copy';

  const [phase, setPhase] = useState<CopyPhase>('idle');
  const [basePoint, setBasePoint] = useState<Point2D | null>(null);

  /** Snapshot of copyable entity IDs captured on activation — stable throughout the session. */
  const idsRef = useRef<string[]>([]);
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

      // Any id that resolves to a live entity is copyable (DXF + BIM + group).
      const ids = selectedEntityIds.filter(
        (id) => scene?.entities.some((x) => x.id === id) ?? false,
      );

      idsRef.current = ids;

      if (ids.length === 0) {
        // Nothing copyable selected → revert immediately.
        onToolChange?.('select');
      } else {
        setPhase('awaiting-base-point');
        setBasePoint(null);
      }
    } else if (!isActive && wasActiveRef.current) {
      setPhase('idle');
      setBasePoint(null);
      idsRef.current = [];
    }

    wasActiveRef.current = isActive;
  }, [isActive, selectedEntityIds, levelManager, onToolChange]);

  // ── Click: base point → target point → clone (continuous loop) ───────────

  const handleCopyClick = useCallback((worldPoint: Point2D): void => {
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
      // Resolve the frozen selection to live entities, then clone through the
      // shared BIM+DXF SSoT (id regeneration + host rewire + persistence inside).
      const sources = idsRef.current
        .map((id) => sm.getEntity(id))
        .filter((e): e is SceneEntity => e !== null && e !== undefined);
      const result = buildEntityCloneCommand(sources, delta, sm);
      if (result) executeCommand(result.command);
      // Continuous: keep the base point, loop for the next target.
    }
  }, [isActive, phase, basePoint, getSceneManager, executeCommand]);

  // ── Escape: exit to select ────────────────────────────────────────────────

  const handleCopyEscape = useCallback((): void => {
    setPhase('idle');
    setBasePoint(null);
    idsRef.current = [];
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

  return { isActive, phase, handleCopyClick, handleCopyEscape };
}
