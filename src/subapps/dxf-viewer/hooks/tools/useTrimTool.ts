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
import { computeHoverPreviewPath } from '../../systems/trim/trim-hover-preview';
import { buildEntityPreviewPath, detectFenceHits } from '../../systems/trim/trim-fence-hit-detector';
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
  const lastHoverMsRef = useRef(0);

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

  // Keep performTrimPick registered in TrimToolStore so leaves can call it
  // without prop-threading through CanvasLayerStack (ADR-040 principle).
  useEffect(() => {
    if (!isActive) return;
    TrimToolStore.registerPickFn(performTrimPick);
    return () => {
      TrimToolStore.registerPickFn(null);
    };
  }, [isActive, performTrimPick]);

  // Fence trim: batch-trim all entities crossed by the drag fence segment (Phase 4).
  const performFenceTrim = useCallback(
    (fenceStart: Point2D, fenceEnd: Point2D, shiftKey: boolean): void => {
      const sm = getSceneManager();
      if (!sm || !levelManager.currentLevelId) return;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      if (!scene) return;

      const state = TrimToolStore.getState();
      const hits = detectFenceHits({
        fenceStart, fenceEnd, scene,
        mode: state.mode, cuttingEdgeIds: state.cuttingEdgeIds,
      });
      if (hits.length === 0) return;

      const edges = resolveCuttingEdges({
        mode: state.mode, scene,
        selectedEdgeIds: state.cuttingEdgeIds, edgeMode: state.edgeMode,
      });

      const allOps: TrimOperation[] = [];
      for (const hit of hits) {
        const target = scene.entities.find((e) => e.id === hit.entityId) as Entity | undefined;
        if (!target) continue;
        if (target.type === 'hatch') { TrimToolStore.incrementWarning('hatch'); continue; }
        const layer = target.layer ? scene.layers[target.layer] : undefined;
        if (layer?.locked) { TrimToolStore.incrementWarning('locked'); continue; }
        const intersections = computeIntersectionPoints(target, edges);
        const result = trimEntity({
          entity: target, intersections,
          pickPoint: hit.pickPoint, mode: state.mode, newId: generateEntityId,
        });
        if (result.operations.length === 0) continue;
        if (result.operations.some((o) => o.kind === 'delete') && intersections.length === 0) {
          TrimToolStore.incrementWarning('deletedNoIntersection');
        }
        allOps.push(...result.operations);
      }

      if (allOps.length === 0) return;
      const midpoint: Point2D = { x: (fenceStart.x + fenceEnd.x) / 2, y: (fenceStart.y + fenceEnd.y) / 2 };
      const cmd = new TrimEntityCommand({ operations: allOps, pickPoint: midpoint, inverse: shiftKey }, sm);
      executeCommand(cmd);
      lastCommandRef.current = cmd;
    },
    [getSceneManager, levelManager, executeCommand],
  );

  useEffect(() => {
    if (!isActive) return;
    TrimToolStore.registerFenceFn(performFenceTrim);
    return () => {
      TrimToolStore.registerFenceFn(null);
    };
  }, [isActive, performFenceTrim]);

  // Live fence drag preview — highlights entities that would be trimmed (G5 / Phase 5).
  // Called throttled from useTrimDragCapture; scene access is only available here.
  const computeFencePreview = useCallback(
    (fenceStart: Point2D, fenceEnd: Point2D): void => {
      if (!levelManager.currentLevelId) return;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      if (!scene) return;
      const state = TrimToolStore.getState();
      const hits = detectFenceHits({
        fenceStart, fenceEnd, scene,
        mode: state.mode, cuttingEdgeIds: state.cuttingEdgeIds,
      });
      if (hits.length === 0) {
        TrimToolStore.setDragPreview(null);
        return;
      }
      const previews = hits.map((hit) => {
        const entity = scene.entities.find((e) => e.id === hit.entityId) as Entity | undefined;
        const path = entity ? buildEntityPreviewPath(entity) : [];
        return { kind: 'remove' as const, entityId: hit.entityId, path };
      });
      TrimToolStore.setDragPreview({ previews });
    },
    [levelManager],
  );

  useEffect(() => {
    if (!isActive) return;
    TrimToolStore.registerFencePreviewFn(computeFencePreview);
    return () => {
      TrimToolStore.registerFencePreviewFn(null);
    };
  }, [isActive, computeFencePreview]);

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

      const state = TrimToolStore.getState();
      if (state.phase !== 'picking') {
        TrimToolStore.setHoverPreview(null);
        return;
      }
      // Throttle to ~20fps — hover preview computation traverses the scene.
      const now = Date.now();
      if (now - lastHoverMsRef.current < 50) return;
      lastHoverMsRef.current = now;

      const hitId = hitTestEntity(worldPoint);
      if (!hitId || !levelManager.currentLevelId) { TrimToolStore.setHoverPreview(null); return; }
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      if (!scene) { TrimToolStore.setHoverPreview(null); return; }
      const target = scene.entities.find((e) => e.id === hitId) as Entity | undefined;
      if (!target || !isTrimmable(target)) { TrimToolStore.setHoverPreview(null); return; }

      const edges = resolveCuttingEdges({
        mode: state.mode, scene, selectedEdgeIds: state.cuttingEdgeIds, edgeMode: state.edgeMode,
      });
      const intersections = computeIntersectionPoints(target, edges);
      const path = computeHoverPreviewPath(target, intersections, worldPoint);
      TrimToolStore.setHoverPreview(
        path.length >= 2 ? { kind: state.inverseMode ? 'add' : 'remove', entityId: hitId, path } : null,
      );
    },
    [isActive, hitTestEntity, levelManager],
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
