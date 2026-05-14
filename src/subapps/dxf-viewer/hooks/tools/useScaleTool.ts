/**
 * USE SCALE TOOL — ADR-348
 *
 * State machine hook for entity scaling (AutoCAD SC pattern).
 *
 * State machine:
 *   idle → selecting → base_point → scale_input → (execute) → idle
 *
 * Sub-phases of scale_input:
 *   direct → direct_x → direct_y (non-uniform path)
 *   ref_p1_x → ref_p2_x → ref_new_x → ref_p1_y → ref_p2_y → ref_new_y (non-uniform reference)
 *
 * Keys: C=copy mode, R=reference, N=non-uniform, digits=numeric buffer, Enter=confirm, ESC=cancel
 *
 * @module hooks/tools/useScaleTool
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import i18next from 'i18next';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas/PreviewCanvas';
import { ScaleEntityCommand } from '../../core/commands/entity-commands/ScaleEntityCommand';
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { ScaleToolStore } from '../../systems/scale/ScaleToolStore';
import { computeUniformRef } from '../../systems/scale/scale-reference-calc';
import type { useLevels } from '../../systems/levels';
import type { ScaleSubPhase } from '../../systems/scale/ScaleToolStore';

// ── Types ─────────────────────────────────────────────────────────────────────

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseScaleToolProps {
  activeTool: string;
  selectedEntityIds: string[];
  levelManager: LevelManagerLike;
  executeCommand: (cmd: ICommand) => void;
  previewCanvasRef: React.RefObject<PreviewCanvasHandle | null>;
  onToolChange?: (tool: string) => void;
}

export interface UseScaleToolReturn {
  isActive: boolean;
  isCollectingInput: boolean;
  handleScaleClick: (worldPoint: Point2D) => void;
  handleScaleEscape: () => void;
  handleScaleKeyDown: (key: string) => boolean;
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

function phaseToPromptKey(phase: string, subPhase: string): string {
  if (phase === 'selecting') return 'scaleTool.selectObjects';
  if (phase === 'base_point') return 'scaleTool.specifyBasePoint';
  if (subPhase === 'direct') return 'scaleTool.enterScaleFactor';
  if (subPhase === 'direct_x') return 'scaleTool.enterScaleX';
  if (subPhase === 'direct_y') return 'scaleTool.enterScaleY';
  if (subPhase === 'ref_p1_x' || subPhase === 'ref_p1_y') return 'scaleTool.refPoint1';
  if (subPhase === 'ref_p2_x' || subPhase === 'ref_p2_y') return 'scaleTool.refPoint2';
  if (subPhase === 'ref_new_x' || subPhase === 'ref_new_y') return 'scaleTool.refNewLength';
  return 'scaleTool.selectObjects';
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useScaleTool(props: UseScaleToolProps): UseScaleToolReturn {
  const { activeTool, selectedEntityIds, levelManager, executeCommand, previewCanvasRef, onToolChange } = props;

  const [promptText, setPromptText] = useState('');
  const wasActiveRef = useRef(false);
  const prevEntityCountRef = useRef(0);

  const isActive = activeTool === 'scale';
  const state = ScaleToolStore.getState();
  const isCollectingInput = isActive && (state.phase === 'base_point' || state.phase === 'scale_input');

  const getSceneManager = useCallback(() => {
    if (!levelManager.currentLevelId) return null;
    return new LevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
  }, [levelManager]);

  // ── State machine transitions ─────────────────────────────────────────────

  useEffect(() => {
    const toolIsScale = activeTool === 'scale';
    const hasEntities = selectedEntityIds.length > 0;

    if (toolIsScale && !wasActiveRef.current) {
      ScaleToolStore.setSelectedEntityIds(selectedEntityIds);
      ScaleToolStore.setPhase(hasEntities ? 'base_point' : 'selecting');
      previewCanvasRef.current?.clear();
    } else if (!toolIsScale && wasActiveRef.current) {
      ScaleToolStore.reset();
      previewCanvasRef.current?.clear();
    } else if (toolIsScale && wasActiveRef.current) {
      const s = ScaleToolStore.getState();
      if (prevEntityCountRef.current === 0 && hasEntities && s.phase === 'selecting') {
        ScaleToolStore.setSelectedEntityIds(selectedEntityIds);
        ScaleToolStore.setPhase('base_point');
      }
    }

    wasActiveRef.current = toolIsScale;
    prevEntityCountRef.current = selectedEntityIds.length;
  }, [activeTool, selectedEntityIds, previewCanvasRef]);

  // ── Execute ───────────────────────────────────────────────────────────────

  const executeScale = useCallback((sx: number, sy: number) => {
    const s = ScaleToolStore.getState();
    if (!s.basePoint) return;
    if (sx === 0 || sy === 0) {
      toolHintOverrideStore.setOverride(i18next.t('tool-hints:scaleTool.invalidZeroFactor'));
      return;
    }

    const { workable, skipped } = filterLockedEntities(
      s.selectedEntityIds,
      levelManager.getLevelScene,
      levelManager.currentLevelId,
    );

    if (workable.length === 0) {
      toolHintOverrideStore.setOverride(i18next.t('tool-hints:scaleTool.allLockedAbort'));
      ScaleToolStore.reset();
      previewCanvasRef.current?.clear();
      onToolChange?.('select');
      return;
    }

    if (skipped > 0) {
      toolHintOverrideStore.setOverride(
        i18next.t('tool-hints:scaleTool.lockedLayerSkipped', { count: skipped }),
      );
    }

    const sm = getSceneManager();
    if (!sm) return;

    const params = sx === sy
      ? { mode: 'uniform' as const, factor: sx }
      : { mode: 'non-uniform' as const, sx, sy };

    executeCommand(new ScaleEntityCommand(workable, s.basePoint, params, s.copyMode, sm));
    previewCanvasRef.current?.clear();
    ScaleToolStore.reset();
    onToolChange?.('select');
  }, [levelManager, getSceneManager, executeCommand, previewCanvasRef, onToolChange]);

  // ── Click handler ─────────────────────────────────────────────────────────

  const handleScaleClick = useCallback((worldPoint: Point2D) => {
    if (!isActive) return;
    const s = ScaleToolStore.getState();

    if (s.phase === 'base_point') {
      ScaleToolStore.setBasePoint(worldPoint);
      ScaleToolStore.setPhase('scale_input', 'direct');
      return;
    }

    if (s.phase !== 'scale_input') return;
    routeReferenceClick(s.subPhase, worldPoint);
  }, [isActive]);

  // ── Escape handler ────────────────────────────────────────────────────────

  const handleScaleEscape = useCallback(() => {
    ScaleToolStore.reset();
    previewCanvasRef.current?.clear();
    onToolChange?.('select');
  }, [previewCanvasRef, onToolChange]);

  // ── Keyboard handler ──────────────────────────────────────────────────────

  const handleScaleKeyDown = useCallback((key: string): boolean => {
    if (!isActive) return false;
    if (key === 'Escape') { handleScaleEscape(); return true; }

    const s = ScaleToolStore.getState();
    if (s.phase !== 'scale_input') return false;

    return dispatchScaleKey(key, s, executeScale);
  }, [isActive, handleScaleEscape, executeScale]);

  // ── Prompt sync ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isActive || state.phase === 'idle') {
      toolHintOverrideStore.setOverride(null);
      return;
    }
    const key = phaseToPromptKey(state.phase, state.subPhase);
    const text = i18next.t(`tool-hints:${key}`);
    setPromptText(text);
    toolHintOverrideStore.setOverride(text);
    return () => { toolHintOverrideStore.setOverride(null); };
  }, [isActive, state.phase, state.subPhase]);

  return { isActive, isCollectingInput, handleScaleClick, handleScaleEscape, handleScaleKeyDown, prompt: promptText };
}

// ── Reference click routing (module-level, no deps) ───────────────────────────

function routeReferenceClick(subPhase: ScaleSubPhase, pt: Point2D): void {
  switch (subPhase) {
    case 'ref_p1_x': ScaleToolStore.setRefPoint('refP1x', pt); ScaleToolStore.setSubPhase('ref_p2_x'); break;
    case 'ref_p2_x': ScaleToolStore.setRefPoint('refP2x', pt); ScaleToolStore.setSubPhase('ref_new_x'); break;
    case 'ref_p1_y': ScaleToolStore.setRefPoint('refP1y', pt); ScaleToolStore.setSubPhase('ref_p2_y'); break;
    case 'ref_p2_y': ScaleToolStore.setRefPoint('refP2y', pt); ScaleToolStore.setSubPhase('ref_new_y'); break;
  }
}

// ── Key dispatch (module-level) ───────────────────────────────────────────────

function dispatchScaleKey(
  key: string,
  s: ReturnType<typeof ScaleToolStore.getState>,
  executeScale: (sx: number, sy: number) => void,
): boolean {
  const { subPhase } = s;

  // Mode toggles — only in direct input sub-phases
  if (subPhase === 'direct') {
    if (key === 'c' || key === 'C') { ScaleToolStore.setCopyMode(!s.copyMode); return true; }
    if (key === 'n' || key === 'N') {
      ScaleToolStore.setNonUniformMode(true);
      ScaleToolStore.setSubPhase('direct_x');
      return true;
    }
    if (key === 'r' || key === 'R') { ScaleToolStore.setSubPhase('ref_p1_x'); return true; }
  }

  if (subPhase === 'direct_x' && (key === 'r' || key === 'R')) {
    ScaleToolStore.setSubPhase('ref_p1_x');
    return true;
  }

  if (subPhase === 'direct_y' && (key === 'r' || key === 'R')) {
    ScaleToolStore.setSubPhase('ref_p1_y');
    return true;
  }

  // Numeric buffer
  if (/^\d$/.test(key) || (key === '.' && !s.numericBuffer.includes('.'))
    || (key === '-' && s.numericBuffer.length === 0)) {
    ScaleToolStore.appendBuffer(key);
    return true;
  }

  if (key === 'Backspace') { ScaleToolStore.backspaceBuffer(); return true; }

  if (key === 'Enter') return handleEnterConfirm(subPhase, s, executeScale);

  return false;
}

function handleEnterConfirm(
  subPhase: ScaleSubPhase,
  s: ReturnType<typeof ScaleToolStore.getState>,
  executeScale: (sx: number, sy: number) => void,
): boolean {
  const val = parseNumericBuffer(s.numericBuffer);
  if (val === null) return false;

  if (subPhase === 'direct') { executeScale(val, val); return true; }

  if (subPhase === 'direct_x') {
    ScaleToolStore.setFactors(val, s.currentSy);
    ScaleToolStore.setSubPhase('direct_y');
    return true;
  }

  if (subPhase === 'direct_y') { executeScale(s.currentSx, val); return true; }

  if (subPhase === 'ref_new_x') {
    const { refP1x, refP2x, nonUniformMode } = s;
    if (!refP1x || !refP2x) return false;
    const sx = computeUniformRef(refP1x, refP2x, val);
    if (sx === null) return false;
    if (!nonUniformMode) { executeScale(sx, sx); return true; }
    ScaleToolStore.setFactors(sx, s.currentSy);
    ScaleToolStore.setSubPhase('ref_p1_y');
    return true;
  }

  if (subPhase === 'ref_new_y') {
    const { refP1y, refP2y, currentSx } = s;
    if (!refP1y || !refP2y) return false;
    const sy = computeUniformRef(refP1y, refP2y, val);
    if (sy === null) return false;
    executeScale(currentSx, sy);
    return true;
  }

  return false;
}

function parseNumericBuffer(buf: string): number | null {
  if (!buf) return null;
  const n = parseFloat(buf);
  return isNaN(n) ? null : n;
}
