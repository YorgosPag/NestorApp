/**
 * USE OFFSET TOOL — ADR-510 Φ4d
 *
 * State-machine hook for the AutoCAD-style OFFSET command, «άμεσο» UX
 * (Giorgio 2026-07-04): pick a source entity → a live ghost follows the cursor →
 * click commits one parallel copy; type digits for an exact distance. Continuous
 * loop until ENTER / ESC / right-click. Mirrors `useTrimTool` but far thinner —
 * the live ghost is RAF-driven in `useOffsetPreview` (no drag capture), and each
 * commit is a single {@link OffsetEntityCommand} (no operation union).
 *
 * Keywords: E/Ε → toggle «Erase source»; U → undo last offset.
 *
 * @module hooks/tools/useOffsetTool
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';
import i18next from 'i18next';
import { generateEntityId } from '@/services/enterprise-id.service';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import { OffsetEntityCommand } from '../../core/commands/entity-commands/OffsetEntityCommand';
import { useSceneManagerAdapter, type SceneAdapterLevelManager } from '../../systems/entity-creation/useSceneManagerAdapter';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { OffsetToolStore } from '../../systems/offset/OffsetToolStore';
import { ToolCursorStore } from '../../systems/cursor/ToolCursorStore';
import { offsetEntity, isOffsettable } from '../../systems/offset/offset-entity-geometry';
import { resolveSignedOffset } from '../../systems/offset/offset-side';
import type { Entity } from '../../types/entities';
import { useEdgeTriggeredLifecycle } from './useEdgeTriggeredLifecycle';
import { useToolHintPrompt } from './useToolHintPrompt';

export interface UseOffsetToolProps {
  activeTool: string;
  levelManager: SceneAdapterLevelManager;
  executeCommand: (cmd: ICommand) => void;
  /** Returns the entity ID hit by `worldPoint` within tolerance (shared with trim/extend). */
  hitTestEntity: (worldPoint: Point2D) => string | null;
  onToolChange?: (tool: string) => void;
}

export interface UseOffsetToolReturn {
  isActive: boolean;
  handleOffsetClick: (worldPoint: Point2D) => void;
  handleOffsetEscape: () => void;
  handleOffsetKeyDown: (key: string) => boolean;
}

const KEYWORDS_ERASE = new Set(['e', 'E', 'Ε', 'ε']);
const KEYWORDS_UNDO = new Set(['u', 'U']);

export function useOffsetTool(props: UseOffsetToolProps): UseOffsetToolReturn {
  const { activeTool, levelManager, executeCommand, hitTestEntity, onToolChange } = props;
  const lastCommandRef = useRef<OffsetEntityCommand | null>(null);

  const isActive = activeTool === 'offset';
  const phase = useSyncExternalStore(OffsetToolStore.subscribe, () => OffsetToolStore.getState().phase);

  // Activation / deactivation lifecycle (ADR-589 edge-triggered SSoT)
  useEdgeTriggeredLifecycle(
    isActive,
    () => {
      OffsetToolStore.reset();
      ToolCursorStore.set('offset-pickbox');
    },
    () => {
      ToolCursorStore.reset();
      OffsetToolStore.reset();
    },
  );

  // Status-bar prompt sync (ADR-589 SSoT)
  useToolHintPrompt(
    isActive,
    phase === 'picking-side' ? 'offsetTool.promptSide' : 'offsetTool.promptSource',
  );

  const getSceneManager = useSceneManagerAdapter(levelManager);

  const performOffsetPick = useCallback(
    (worldPoint: Point2D): void => {
      const sm = getSceneManager();
      if (!sm || !levelManager.currentLevelId) return;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      if (!scene) return;
      const state = OffsetToolStore.getState();

      // Phase 1 — pick the source entity to offset.
      if (state.phase === 'picking-source' || !state.source) {
        const hitId = hitTestEntity(worldPoint);
        if (!hitId) return;
        const target = scene.entities.find((e) => e.id === hitId) as Entity | undefined;
        if (!target || !isOffsettable(target)) return;
        const layer = target.layerId ? (scene.layersById ?? {})[target.layerId] : undefined;
        if (layer?.locked) return;
        OffsetToolStore.setSource(target);
        return;
      }

      // Phase 2 — commit one parallel copy at the cursor-driven (or typed) distance.
      const d = resolveSignedOffset(state.source, worldPoint, state.typedDistance);
      if (d === null) return;
      const copy = offsetEntity(state.source, d, generateEntityId());
      if (!copy) return;
      const cmd = new OffsetEntityCommand(
        { copy, source: state.source, erase: state.eraseSource, pickPoint: worldPoint },
        sm,
      );
      executeCommand(cmd);
      lastCommandRef.current = cmd;
      OffsetToolStore.setLastDistance(Math.abs(d));
      OffsetToolStore.clearSource(); // continuous → back to source-picking
    },
    [getSceneManager, levelManager, hitTestEntity, executeCommand],
  );

  const handleOffsetClick = useCallback(
    (worldPoint: Point2D): void => {
      if (!isActive) return;
      performOffsetPick(worldPoint);
    },
    [isActive, performOffsetPick],
  );

  const handleOffsetEscape = useCallback(() => {
    // Two-level escape (Revit-like): first deselect the source, then exit the tool.
    if (OffsetToolStore.getState().phase === 'picking-side') {
      OffsetToolStore.clearSource();
      return;
    }
    OffsetToolStore.reset();
    onToolChange?.('select');
  }, [onToolChange]);

  const handleOffsetKeyDown = useCallback(
    (key: string): boolean => {
      if (!isActive) return false;
      // Escape is handled centrally via useCanvasEscapeRegistrations
      // (buildModifyHandler('offset', handleOffsetEscape, …)) — SSoT escape bus.
      if (key === 'Enter') {
        OffsetToolStore.reset();
        onToolChange?.('select');
        return true;
      }
      if (/^[0-9]$/.test(key) || key === '.') {
        OffsetToolStore.appendTypedChar(key);
        return true;
      }
      if (key === 'Backspace') {
        OffsetToolStore.popTypedChar();
        return true;
      }
      if (KEYWORDS_ERASE.has(key)) {
        OffsetToolStore.toggleEraseSource();
        const on = OffsetToolStore.getState().eraseSource;
        toolHintOverrideStore.setOverride(i18next.t(`tool-hints:offsetTool.${on ? 'eraseOn' : 'eraseOff'}`));
        return true;
      }
      if (KEYWORDS_UNDO.has(key)) {
        lastCommandRef.current?.undo();
        lastCommandRef.current = null;
        return true;
      }
      return false;
    },
    [isActive, handleOffsetEscape, onToolChange],
  );

  return { isActive, handleOffsetClick, handleOffsetEscape, handleOffsetKeyDown };
}
