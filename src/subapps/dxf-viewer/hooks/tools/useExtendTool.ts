/**
 * USE EXTEND TOOL — ADR-353
 *
 * State-machine hook for the EXTEND command (Quick + Standard modes,
 * keyword routing, SHIFT-inverse TRIM, undo-last, mode/edge toggles).
 *
 * Flow (Quick mode default, Q1):
 *   activate (tool=extend) → phase=picking → click → extend entity → loop
 *   right-click / ENTER / ESC → exit
 *   SHIFT+click → TRIM inverse (Q4) — creates TrimEntityCommand (SSOT)
 *   keywords: Ο/B(boundaries) Α/U(undo) Λ/M(mode) Ε/E(edge)
 *
 * @module hooks/tools/useExtendTool
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import i18next from 'i18next';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import { ExtendEntityCommand } from '../../core/commands/entity-commands/ExtendEntityCommand';
import { TrimEntityCommand } from '../../core/commands/entity-commands/TrimEntityCommand';
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { ExtendToolStore } from '../../systems/extend/ExtendToolStore';
import { ToolCursorStore } from '../../systems/cursor/ToolCursorStore';
import { resolveCuttingEdges, isTrimmable } from '../../systems/trim/trim-boundary-resolver';
import { computeIntersectionPoints } from '../../systems/trim/trim-intersection-mapper';
import { trimEntity } from '../../systems/trim/trim-entity-cutter';
import { castExtendIntersection, isExtendable } from '../../systems/extend/extend-intersection-caster';
import type { ExtendOperation } from '../../systems/extend/extend-types';
import type { Entity } from '../../types/entities';
import type { useLevels } from '../../systems/levels';
import { generateEntityId } from '@/services/enterprise-id.service';

// ── Types ─────────────────────────────────────────────────────────────────────

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseExtendToolProps {
  activeTool: string;
  levelManager: LevelManagerLike;
  executeCommand: (cmd: ICommand) => void;
  hitTestEntity: (worldPoint: Point2D) => string | null;
  onToolChange?: (tool: string) => void;
}

export interface UseExtendToolReturn {
  isActive: boolean;
  handleExtendClick: (worldPoint: Point2D, shiftKey: boolean) => void;
  handleExtendEscape: () => void;
  handleExtendKeyDown: (key: string, shiftKey: boolean) => boolean;
  handleExtendMouseMove: (worldPoint: Point2D, shiftKey: boolean) => void;
}

// ── Keyword routing ──────────────────────────────────────────────────────────

const KEYWORDS_BOUNDARY = new Set(['o', 'O', 'Ο', 'ο', 'b', 'B']);
const KEYWORDS_UNDO = new Set(['a', 'A', 'Α', 'α', 'u', 'U']);
const KEYWORDS_MODE = new Set(['l', 'L', 'Λ', 'λ', 'm', 'M']);
const KEYWORDS_EDGE = new Set(['e', 'E', 'Ε', 'ε']);

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useExtendTool(props: UseExtendToolProps): UseExtendToolReturn {
  const { activeTool, levelManager, executeCommand, hitTestEntity, onToolChange } = props;
  const wasActiveRef = useRef(false);
  const lastCommandRef = useRef<ICommand | null>(null);
  const lastHoverMsRef = useRef(0);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isActive = activeTool === 'extend';
  const phase = useSyncExternalStore(ExtendToolStore.subscribe, () => ExtendToolStore.getState().phase);

  // Activation / deactivation lifecycle
  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      ExtendToolStore.reset();
      ExtendToolStore.setPhase('picking');
      ToolCursorStore.set('extend-arrow');
    } else if (!isActive && wasActiveRef.current) {
      flushAggregatedWarnings();
      ToolCursorStore.reset();
      ExtendToolStore.reset();
    }
    wasActiveRef.current = isActive;
  }, [isActive]);

  // Status-bar prompt sync
  useEffect(() => {
    if (!isActive || phase === 'idle') {
      toolHintOverrideStore.setOverride(null);
      return;
    }
    const key = phase === 'selectingEdges'
      ? 'extendTool.promptStandardEdges'
      : 'extendTool.promptPick';
    toolHintOverrideStore.setOverride(i18next.t(`tool-hints:${key}`));
    return () => {
      toolHintOverrideStore.setOverride(null);
    };
  }, [isActive, phase]);

  // ── Scene helpers ────────────────────────────────────────────────────────

  const getSceneManager = useCallback(() => {
    if (!levelManager.currentLevelId) return null;
    return new LevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
  }, [levelManager]);

  // Show ephemeral "no intersection" status bar message (G8)
  const showNoIntersectionHint = useCallback(() => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    toolHintOverrideStore.setOverride(i18next.t('tool-hints:extendTool.noIntersection'));
    hintTimerRef.current = setTimeout(() => {
      toolHintOverrideStore.setOverride(
        i18next.t(`tool-hints:extendTool.promptPick`),
      );
    }, 2000);
  }, []);

  const performExtendPick = useCallback(
    (worldPoint: Point2D, shiftKey: boolean): void => {
      const sm = getSceneManager();
      if (!sm || !levelManager.currentLevelId) return;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      if (!scene) return;

      const hitId = hitTestEntity(worldPoint);
      if (!hitId) return;
      const target = scene.entities.find((e) => e.id === hitId) as Entity | undefined;
      if (!target) return;

      const layer = target.layer ? scene.layers[target.layer] : undefined;
      if (layer?.locked) {
        ExtendToolStore.incrementWarning('locked');
        return;
      }

      const state = ExtendToolStore.getState();
      const boundaries = resolveCuttingEdges({
        mode: state.mode,
        scene,
        selectedEdgeIds: state.boundaryEdgeIds,
        edgeMode: state.edgeMode,
      });

      if (shiftKey) {
        // SHIFT+click → TRIM inverse (ADR-353 Q4, G7 — reuse TrimEntityCommand SSoT)
        if (!isTrimmable(target)) return;
        const intersections = computeIntersectionPoints(target, boundaries);
        const result = trimEntity({
          entity: target,
          intersections,
          pickPoint: worldPoint,
          mode: state.mode,
          newId: generateEntityId,
        });
        if (result.operations.length === 0) return;
        const cmd = new TrimEntityCommand(
          { operations: result.operations, pickPoint: worldPoint, inverse: true },
          sm,
        );
        executeCommand(cmd);
        lastCommandRef.current = cmd;
        return;
      }

      // Normal click → EXTEND
      if (!isExtendable(target)) return;
      const op = castExtendIntersection(target, worldPoint, boundaries);
      if (!op) {
        showNoIntersectionHint();
        return;
      }
      const ops: ExtendOperation[] = [op];
      const cmd = new ExtendEntityCommand({ operations: ops, pickPoint: worldPoint }, sm);
      executeCommand(cmd);
      lastCommandRef.current = cmd;
    },
    [getSceneManager, levelManager, hitTestEntity, executeCommand, showNoIntersectionHint],
  );

  useEffect(() => {
    if (!isActive) return;
    ExtendToolStore.registerPickFn(performExtendPick);
    return () => {
      ExtendToolStore.registerPickFn(null);
    };
  }, [isActive, performExtendPick]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleExtendClick = useCallback(
    (worldPoint: Point2D, shiftKey: boolean): void => {
      if (!isActive) return;
      const state = ExtendToolStore.getState();
      if (state.phase === 'idle') return;
      performExtendPick(worldPoint, shiftKey);
    },
    [isActive, performExtendPick],
  );

  const handleExtendEscape = useCallback(() => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    flushAggregatedWarnings();
    ExtendToolStore.reset();
    onToolChange?.('select');
  }, [onToolChange]);

  const handleExtendKeyDown = useCallback(
    (key: string, shiftKey: boolean): boolean => {
      if (!isActive) return false;
      if (key === 'Escape') {
        handleExtendEscape();
        return true;
      }
      if (key === 'Shift') {
        ExtendToolStore.setInverseMode(shiftKey);
        ToolCursorStore.set(shiftKey ? 'trim-pickbox' : 'extend-arrow');
        return true;
      }
      if (key === 'Enter') {
        const s = ExtendToolStore.getState();
        if (s.phase === 'selectingEdges') {
          ExtendToolStore.setPhase('picking');
          return true;
        }
        handleExtendEscape();
        return true;
      }
      if (KEYWORDS_BOUNDARY.has(key)) {
        ExtendToolStore.toggleMode();
        const next = ExtendToolStore.getState().mode;
        ExtendToolStore.setPhase(next === 'standard' ? 'selectingEdges' : 'picking');
        return true;
      }
      if (KEYWORDS_MODE.has(key)) {
        ExtendToolStore.toggleMode();
        return true;
      }
      if (KEYWORDS_UNDO.has(key)) {
        const last = lastCommandRef.current;
        if (last) {
          last.undo();
          lastCommandRef.current = null;
        } else {
          toolHintOverrideStore.setOverride(i18next.t('tool-hints:extendTool.undoEmpty'));
        }
        return true;
      }
      if (KEYWORDS_EDGE.has(key) && !shiftKey) {
        ExtendToolStore.toggleEdgeMode();
        return true;
      }
      return false;
    },
    [isActive, handleExtendEscape],
  );

  const handleExtendMouseMove = useCallback(
    (worldPoint: Point2D, shiftKey: boolean): void => {
      if (!isActive) return;
      ExtendToolStore.setInverseMode(shiftKey);

      const state = ExtendToolStore.getState();
      if (state.phase !== 'picking') {
        ExtendToolStore.setHoverPreview(null);
        return;
      }
      const now = Date.now();
      if (now - lastHoverMsRef.current < 80) return;
      lastHoverMsRef.current = now;

      ExtendToolStore.setHoverPoint(worldPoint);
      const hitId = hitTestEntity(worldPoint);
      if (!hitId || !levelManager.currentLevelId) { ExtendToolStore.setHoverPreview(null); return; }
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      if (!scene) { ExtendToolStore.setHoverPreview(null); return; }
      const target = scene.entities.find((e) => e.id === hitId) as Entity | undefined;
      if (!target || !isExtendable(target)) { ExtendToolStore.setHoverPreview(null); return; }

      const boundaries = resolveCuttingEdges({
        mode: state.mode, scene,
        selectedEdgeIds: state.boundaryEdgeIds, edgeMode: state.edgeMode,
      });
      const op = castExtendIntersection(target, worldPoint, boundaries);
      if (!op || op.kind !== 'extend') { ExtendToolStore.setHoverPreview(null); return; }

      // Preview path: original endpoint → new (extended) endpoint
      const orig = op.originalGeom;
      const next = op.newGeom;
      const origPath = entityEndpoints(orig as Entity);
      const nextPath = entityEndpoints(next as Entity);
      if (!origPath || !nextPath) { ExtendToolStore.setHoverPreview(null); return; }

      // Ghost = segment from old endpoint to new endpoint (the extension portion)
      const previewPath = findExtensionSegment(origPath, nextPath);
      if (!previewPath) { ExtendToolStore.setHoverPreview(null); return; }

      ExtendToolStore.setHoverPreview({ entityId: hitId, path: previewPath });
    },
    [isActive, hitTestEntity, levelManager],
  );

  useEffect(() => {
    if (!isActive) return;
    ExtendToolStore.registerHoverMoveFn(handleExtendMouseMove);
    return () => {
      ExtendToolStore.registerHoverMoveFn(null);
    };
  }, [isActive, handleExtendMouseMove]);

  return {
    isActive,
    handleExtendClick,
    handleExtendEscape,
    handleExtendKeyDown,
    handleExtendMouseMove,
  };
}

// ── Internals ────────────────────────────────────────────────────────────────

function flushAggregatedWarnings(): void {
  const { warnings } = ExtendToolStore.getState();
  if (warnings.locked > 0) {
    toolHintOverrideStore.setOverride(
      i18next.t('tool-hints:extendTool.lockedSkipped', { count: warnings.locked }),
    );
  }
  ExtendToolStore.clearWarnings();
}

type Endpoints = { start: { x: number; y: number }; end: { x: number; y: number } };

function entityEndpoints(entity: Entity): Endpoints | null {
  if ('start' in entity && 'end' in entity) {
    return { start: (entity as { start: { x: number; y: number } }).start, end: (entity as { end: { x: number; y: number } }).end };
  }
  if ('vertices' in entity && Array.isArray((entity as { vertices: { x: number; y: number }[] }).vertices)) {
    const v = (entity as { vertices: { x: number; y: number }[] }).vertices;
    if (v.length < 2) return null;
    return { start: v[0], end: v[v.length - 1] };
  }
  return null;
}

function findExtensionSegment(
  original: Endpoints,
  extended: Endpoints,
): [{ x: number; y: number }, { x: number; y: number }] | null {
  // Find which endpoint changed (the extended one)
  const startMoved = Math.hypot(
    extended.start.x - original.start.x,
    extended.start.y - original.start.y,
  ) > 1e-6;
  const endMoved = Math.hypot(
    extended.end.x - original.end.x,
    extended.end.y - original.end.y,
  ) > 1e-6;

  if (startMoved) return [original.start, extended.start];
  if (endMoved) return [original.end, extended.end];
  return null;
}
