/**
 * USE STRETCH TOOL — ADR-349 Phase 1a
 *
 * State machine hook for entity stretch (AutoCAD STRETCH/MSTRETCH).
 *
 * Phase 1a scope:
 *   - Pre-selected entities → rigid MOVE on whole entities (Q8 industry std)
 *   - State machine:  IDLE → BASE_POINT → DISPLACEMENT → DONE
 *   - Keyboard "dx,dy" numeric input or 2-click base→target
 *   - ESC cancels, Enter confirms numeric buffer
 *
 * Deferred to Phase 1c:
 *   - Crossing-window drag inside the command (selection sub-state machine)
 *   - Crossing-polygon (CP/ΠΟ) keyword
 *   - Live preview overlay (StretchPreviewOverlay micro-leaf)
 *   - DIMENSION defpoint resolver + HATCH associative-follow
 *
 * @module hooks/tools/useStretchTool
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import i18next from 'i18next';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import { StretchEntityCommand, type StretchVertexMove } from '../../core/commands/entity-commands/StretchEntityCommand';
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { StretchToolStore } from '../../systems/stretch/StretchToolStore';
import { enumerateVertices, getAnchorPoint } from '../../systems/stretch/stretch-vertex-classifier';
import type { useLevels } from '../../systems/levels';
import type { Entity } from '../../types/entities';

// ── Types ─────────────────────────────────────────────────────────────────────

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseStretchToolProps {
  activeTool: string;
  selectedEntityIds: string[];
  levelManager: LevelManagerLike;
  executeCommand: (cmd: ICommand) => void;
  onToolChange?: (tool: string) => void;
}

export interface UseStretchToolReturn {
  isActive: boolean;
  isCollectingInput: boolean;
  handleStretchClick: (worldPoint: Point2D) => void;
  handleStretchEscape: () => void;
  handleStretchKeyDown: (key: string) => boolean;
  prompt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function filterLockedEntities(
  ids: string[],
  getLevelScene: LevelManagerLike['getLevelScene'],
  levelId: string | null,
): { workable: string[]; skipped: number } {
  if (!levelId) return { workable: ids, skipped: 0 };
  const scene = getLevelScene(levelId);
  if (!scene) return { workable: ids, skipped: 0 };
  const workable: string[] = [];
  for (const id of ids) {
    const entity = scene.entities.find(e => e.id === id);
    const layer = entity?.layer ? scene.layers[entity.layer] : undefined;
    if (layer?.locked) continue;
    workable.push(id);
  }
  return { workable, skipped: ids.length - workable.length };
}

function phaseToPromptKey(phase: string): string {
  if (phase === 'selecting') return 'stretchTool.selectObjects';
  if (phase === 'base_point') return 'stretchTool.specifyBasePoint';
  if (phase === 'displacement') return 'stretchTool.specifyDisplacement';
  return 'stretchTool.selectObjects';
}

function parseDisplacement(buf: string): { x: number; y: number } | null {
  if (!buf) return null;
  const parts = buf.split(',');
  if (parts.length !== 2) return null;
  const x = parseFloat(parts[0]);
  const y = parseFloat(parts[1]);
  if (isNaN(x) || isNaN(y)) return null;
  return { x, y };
}

function partitionByAddressability(
  workable: string[],
  entities: ReadonlyArray<Entity>,
): { vertexMoves: StretchVertexMove[]; anchorMoves: string[] } {
  const vertexMoves: StretchVertexMove[] = [];
  const anchorMoves: string[] = [];
  for (const id of workable) {
    const entity = entities.find(e => e.id === id);
    if (!entity) continue;
    const refs = enumerateVertices(entity);
    if (refs.length > 0) {
      vertexMoves.push({ entityId: id, refs });
    } else if (getAnchorPoint(entity) !== null) {
      anchorMoves.push(id);
    }
  }
  return { vertexMoves, anchorMoves };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useStretchTool(props: UseStretchToolProps): UseStretchToolReturn {
  const { activeTool, selectedEntityIds, levelManager, executeCommand, onToolChange } = props;

  const [promptText, setPromptText] = useState('');
  const wasActiveRef = useRef(false);

  const isActive = activeTool === 'stretch' || activeTool === 'mstretch';
  const state = StretchToolStore.getState();
  const isCollectingInput = isActive && (state.phase === 'base_point' || state.phase === 'displacement');

  const getSceneManager = useCallback(() => {
    if (!levelManager.currentLevelId) return null;
    return new LevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
  }, [levelManager]);

  // ── Activation / deactivation ─────────────────────────────────────────────

  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      StretchToolStore.setMode(activeTool === 'mstretch' ? 'multi' : 'single');
      if (selectedEntityIds.length > 0) {
        StretchToolStore.setSelectionMode('pre-selected');
        StretchToolStore.setPhase('base_point');
      } else {
        // Phase 1a: in-command crossing-window drag is deferred to Phase 1c.
        // For now, require pre-selection. Toast + return to select.
        toolHintOverrideStore.setOverride(i18next.t('tool-hints:stretchTool.nothingToStretch'));
        StretchToolStore.reset();
        onToolChange?.('select');
      }
    } else if (!isActive && wasActiveRef.current) {
      StretchToolStore.reset();
    }
    wasActiveRef.current = isActive;
  }, [isActive, activeTool, selectedEntityIds, onToolChange]);

  // ── Execute ───────────────────────────────────────────────────────────────

  const executeStretch = useCallback((dx: number, dy: number) => {
    if (dx === 0 && dy === 0) {
      toolHintOverrideStore.setOverride(i18next.t('tool-hints:stretchTool.invalidZeroDisplacement'));
      return;
    }

    const { workable, skipped } = filterLockedEntities(
      selectedEntityIds,
      levelManager.getLevelScene,
      levelManager.currentLevelId,
    );

    if (workable.length === 0) {
      toolHintOverrideStore.setOverride(i18next.t('tool-hints:stretchTool.allLockedAbort'));
      StretchToolStore.reset();
      onToolChange?.('select');
      return;
    }

    if (skipped > 0) {
      toolHintOverrideStore.setOverride(
        i18next.t('tool-hints:stretchTool.lockedLayerSkipped', { count: skipped }),
      );
    }

    const sm = getSceneManager();
    if (!sm || !levelManager.currentLevelId) return;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return;

    const { vertexMoves, anchorMoves } = partitionByAddressability(
      workable, scene.entities as ReadonlyArray<Entity>,
    );

    executeCommand(new StretchEntityCommand(
      { vertexMoves, anchorMoves, displacement: { x: dx, y: dy } },
      sm,
    ));
    StretchToolStore.reset();
    onToolChange?.('select');
  }, [selectedEntityIds, levelManager, getSceneManager, executeCommand, onToolChange]);

  // ── Click handler ─────────────────────────────────────────────────────────

  const handleStretchClick = useCallback((worldPoint: Point2D) => {
    if (!isActive) return;
    const s = StretchToolStore.getState();
    if (s.phase === 'base_point') {
      StretchToolStore.setBasePoint(worldPoint);
      StretchToolStore.setPhase('displacement');
      return;
    }
    if (s.phase === 'displacement' && s.basePoint) {
      executeStretch(worldPoint.x - s.basePoint.x, worldPoint.y - s.basePoint.y);
    }
  }, [isActive, executeStretch]);

  // ── Escape handler ────────────────────────────────────────────────────────

  const handleStretchEscape = useCallback(() => {
    StretchToolStore.reset();
    onToolChange?.('select');
  }, [onToolChange]);

  // ── Keyboard handler ──────────────────────────────────────────────────────

  const handleStretchKeyDown = useCallback((key: string): boolean => {
    if (!isActive) return false;
    if (key === 'Escape') { handleStretchEscape(); return true; }

    const s = StretchToolStore.getState();
    if (s.phase !== 'displacement') return false;

    if (/^\d$/.test(key) || key === '.' || key === ',' ||
        (key === '-' && !s.numericBuffer.includes('-'))) {
      StretchToolStore.appendBuffer(key);
      return true;
    }
    if (key === 'Backspace') { StretchToolStore.backspaceBuffer(); return true; }
    if (key === 'Enter') {
      const delta = parseDisplacement(s.numericBuffer);
      if (delta) executeStretch(delta.x, delta.y);
      return true;
    }
    return false;
  }, [isActive, handleStretchEscape, executeStretch]);

  // ── Prompt sync ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isActive || state.phase === 'idle') {
      toolHintOverrideStore.setOverride(null);
      return;
    }
    const key = phaseToPromptKey(state.phase);
    const text = i18next.t(`tool-hints:${key}`);
    setPromptText(text);
    toolHintOverrideStore.setOverride(text);
    return () => { toolHintOverrideStore.setOverride(null); };
  }, [isActive, state.phase]);

  return { isActive, isCollectingInput, handleStretchClick, handleStretchEscape, handleStretchKeyDown, prompt: promptText };
}
