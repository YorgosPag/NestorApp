/**
 * USE TRIM TOOL — ADR-350 Phase 2
 *
 * State-machine hook for the TRIM command (Quick + Standard modes,
 * keyword routing, SHIFT-inverse EXTEND, eRase, undo-last, mode/edge toggles).
 *
 * Flow (Quick mode default, Q1):
 *   activate (tool=trim) → phase=picking → click→trim entity → loop
 *   right-click / ENTER / ESC → exit
 *   SHIFT+click → EXTEND inverse (Q9)
 *   keywords:  Ο/B(boundaries) Δ/R(eRase) Α/U(undo) Λ/M(mode) Ε/E(edge)
 *
 * @module hooks/tools/useTrimTool
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import i18next from 'i18next';
import { generateEntityId } from '@/services/enterprise-id.service';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import { TrimEntityCommand } from '../../core/commands/entity-commands/TrimEntityCommand';
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { TrimToolStore } from '../../systems/trim/TrimToolStore';
import { ToolCursorStore } from '../../systems/cursor/ToolCursorStore';
import { resolveCuttingEdges, isTrimmable } from '../../systems/trim/trim-boundary-resolver';
import { computeIntersectionPoints } from '../../systems/trim/trim-intersection-mapper';
import { trimEntity } from '../../systems/trim/trim-entity-cutter';
import type { TrimOperation } from '../../systems/trim/trim-types';
import type { Entity } from '../../types/entities';
import type { useLevels } from '../../systems/levels';

// ── Types ─────────────────────────────────────────────────────────────────────

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseTrimToolProps {
  activeTool: string;
  levelManager: LevelManagerLike;
  executeCommand: (cmd: ICommand) => void;
  /** Returns the entity ID hit by `worldPoint` within tolerance (snap-only path). */
  hitTestEntity: (worldPoint: Point2D) => string | null;
  onToolChange?: (tool: string) => void;
}

export interface UseTrimToolReturn {
  isActive: boolean;
  handleTrimClick: (worldPoint: Point2D, shiftKey: boolean) => void;
  handleTrimEscape: () => void;
  handleTrimKeyDown: (key: string, shiftKey: boolean) => boolean;
  handleTrimMouseMove: (worldPoint: Point2D, shiftKey: boolean) => void;
}

// ── Keyword routing ──────────────────────────────────────────────────────────

const KEYWORDS_BOUNDARY = new Set(['o', 'O', 'Ο', 'ο', 'b', 'B']);
const KEYWORDS_ERASE = new Set(['d', 'D', 'Δ', 'δ', 'r', 'R']);
const KEYWORDS_UNDO = new Set(['a', 'A', 'Α', 'α', 'u', 'U']);
const KEYWORDS_MODE = new Set(['l', 'L', 'Λ', 'λ', 'm', 'M']);
const KEYWORDS_EDGE = new Set(['e', 'E', 'Ε', 'ε']);

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTrimTool(props: UseTrimToolProps): UseTrimToolReturn {
  const { activeTool, levelManager, executeCommand, hitTestEntity, onToolChange } = props;
  const wasActiveRef = useRef(false);
  const lastCommandRef = useRef<TrimEntityCommand | null>(null);

  const isActive = activeTool === 'trim';
  const phase = useSyncExternalStore(TrimToolStore.subscribe, () => TrimToolStore.getState().phase);

  // Activation / deactivation lifecycle
  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      TrimToolStore.reset();
      TrimToolStore.setPhase('picking');
      ToolCursorStore.set('trim-pickbox');
    } else if (!isActive && wasActiveRef.current) {
      flushAggregatedWarnings();
      ToolCursorStore.reset();
      TrimToolStore.reset();
    }
    wasActiveRef.current = isActive;
  }, [isActive]);

  // Keep performTrimPick registered in TrimToolStore so leaves can call it
  // without prop-threading through CanvasLayerStack (ADR-040 principle).
  useEffect(() => {
    if (!isActive) return;
    TrimToolStore.registerPickFn(performTrimPick);
    return () => {
      TrimToolStore.registerPickFn(null);
    };
  }, [isActive, performTrimPick]);

  // Status-bar prompt sync (G13)
  useEffect(() => {
    if (!isActive || phase === 'idle') {
      toolHintOverrideStore.setOverride(null);
      return;
    }
    const key =
      phase === 'selectingEdges' ? 'trimTool.promptStandardEdges' : 'trimTool.promptPick';
    toolHintOverrideStore.setOverride(i18next.t(`tool-hints:${key}`));
    return () => {
      toolHintOverrideStore.setOverride(null);
    };
  }, [isActive, phase]);

  // ── Scene + edge helpers ─────────────────────────────────────────────────

  const getSceneManager = useCallback(() => {
    if (!levelManager.currentLevelId) return null;
    return new LevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
  }, [levelManager]);

  const performTrimPick = useCallback(
    (worldPoint: Point2D, shiftKey: boolean): void => {
      const sm = getSceneManager();
      if (!sm || !levelManager.currentLevelId) return;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      if (!scene) return;

      const state = TrimToolStore.getState();
      const hitId = hitTestEntity(worldPoint);
      if (!hitId) return;
      const target = scene.entities.find((e) => e.id === hitId) as Entity | undefined;
      if (!target) return;

      // HATCH → toast + skip (Q6)
      if (target.type === 'hatch') {
        TrimToolStore.incrementWarning('hatch');
        return;
      }
      if (!isTrimmable(target)) return;

      // Locked-layer guard (Q12)
      const layer = target.layer ? scene.layers[target.layer] : undefined;
      if (layer?.locked) {
        TrimToolStore.incrementWarning('locked');
        return;
      }

      // eRase mode → delete the entity directly (Q2 single-click delete is a
      // distinct behaviour reached when the entity has no intersection; eRase
      // armed deletes regardless of intersection state).
      if (state.eraseArmed) {
        const op: TrimOperation = { kind: 'delete', entityId: target.id, originalGeom: target };
        const cmd = new TrimEntityCommand(
          { operations: [op], pickPoint: worldPoint, inverse: shiftKey },
          sm,
        );
        executeCommand(cmd);
        lastCommandRef.current = cmd;
        TrimToolStore.setEraseArmed(false);
        return;
      }

      const edges = resolveCuttingEdges({
        mode: state.mode,
        scene,
        selectedEdgeIds: state.cuttingEdgeIds,
        edgeMode: state.edgeMode,
      });
      const intersections = computeIntersectionPoints(target, edges);
      const result = trimEntity({
        entity: target,
        intersections,
        pickPoint: worldPoint,
        mode: state.mode,
        newId: generateEntityId,
      });
      if (result.operations.length === 0) return;

      // Note: cutter already returns 'delete' op for Quick-mode no-intersection.
      const hadDelete = result.operations.some((o) => o.kind === 'delete');
      if (hadDelete && intersections.length === 0) {
        TrimToolStore.incrementWarning('deletedNoIntersection');
      }

      const cmd = new TrimEntityCommand(
        { operations: result.operations, pickPoint: worldPoint, inverse: shiftKey },
        sm,
      );
      executeCommand(cmd);
      lastCommandRef.current = cmd;
    },
    [getSceneManager, levelManager, hitTestEntity, executeCommand],
  );

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleTrimClick = useCallback(
    (worldPoint: Point2D, shiftKey: boolean): void => {
      if (!isActive) return;
      const state = TrimToolStore.getState();
      if (state.phase === 'idle') return;
      // SHIFT held = EXTEND inverse. The cutter math is identical for the
      // current scope (Phase 2 reuses TRIM math; inverse flag is audit-only).
      performTrimPick(worldPoint, shiftKey);
    },
    [isActive, performTrimPick],
  );

  const handleTrimEscape = useCallback(() => {
    flushAggregatedWarnings();
    TrimToolStore.reset();
    onToolChange?.('select');
  }, [onToolChange]);

  const handleTrimKeyDown = useCallback(
    (key: string, shiftKey: boolean): boolean => {
      if (!isActive) return false;
      if (key === 'Escape') {
        handleTrimEscape();
        return true;
      }
      // SHIFT keydown / keyup → immediate inverseMode + cursor variant update
      if (key === 'Shift') {
        TrimToolStore.setInverseMode(shiftKey);
        ToolCursorStore.set(shiftKey ? 'extend-arrow' : 'trim-pickbox');
        return true;
      }
      if (key === 'Enter') {
        // Standard mode: ENTER on selectingEdges → switch to picking phase
        const s = TrimToolStore.getState();
        if (s.phase === 'selectingEdges') {
          TrimToolStore.setPhase('picking');
          return true;
        }
        // Picking + ENTER → exit
        handleTrimEscape();
        return true;
      }
      if (KEYWORDS_BOUNDARY.has(key)) {
        TrimToolStore.toggleMode();
        const next = TrimToolStore.getState().mode;
        TrimToolStore.setPhase(next === 'standard' ? 'selectingEdges' : 'picking');
        return true;
      }
      if (KEYWORDS_MODE.has(key)) {
        TrimToolStore.toggleMode();
        return true;
      }
      if (KEYWORDS_ERASE.has(key)) {
        TrimToolStore.setEraseArmed(true);
        toolHintOverrideStore.setOverride(i18next.t('tool-hints:trimTool.eraseArmed'));
        return true;
      }
      if (KEYWORDS_UNDO.has(key)) {
        const last = lastCommandRef.current;
        if (last) {
          last.undo();
          lastCommandRef.current = null;
        } else {
          toolHintOverrideStore.setOverride(i18next.t('tool-hints:trimTool.undoEmpty'));
        }
        return true;
      }
      if (KEYWORDS_EDGE.has(key) && !shiftKey) {
        TrimToolStore.toggleEdgeMode();
        return true;
      }
      return false;
    },
    [isActive, handleTrimEscape],
  );

  const handleTrimMouseMove = useCallback(
    (worldPoint: Point2D, shiftKey: boolean): void => {
      if (!isActive) return;
      TrimToolStore.setHoverPoint(worldPoint);
      TrimToolStore.setInverseMode(shiftKey);
    },
    [isActive],
  );

  return {
    isActive,
    handleTrimClick,
    handleTrimEscape,
    handleTrimKeyDown,
    handleTrimMouseMove,
  };
}

// ── Internals ────────────────────────────────────────────────────────────────

function flushAggregatedWarnings(): void {
  const { warnings } = TrimToolStore.getState();
  const messages: string[] = [];
  if (warnings.hatch > 0) {
    messages.push(i18next.t('tool-hints:trimTool.hatchNotTrimmable'));
  }
  if (warnings.locked > 0) {
    messages.push(i18next.t('tool-hints:trimTool.lockedSkipped', { count: warnings.locked }));
  }
  if (warnings.deletedNoIntersection > 0) {
    messages.push(i18next.t('tool-hints:trimTool.noIntersectionDeleted'));
  }
  if (messages.length > 0) {
    toolHintOverrideStore.setOverride(messages.join(' · '));
  }
  TrimToolStore.clearWarnings();
}
