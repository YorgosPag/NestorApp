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

import { useState, useCallback, useEffect } from 'react';
import i18next from 'i18next';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas/PreviewCanvas';
import { ScaleEntityCommand } from '../../core/commands/entity-commands/ScaleEntityCommand';
import { useSceneManagerAdapter, type SceneAdapterLevelManager } from '../../systems/entity-creation/useSceneManagerAdapter';
import { useModifyToolActivation } from '../../systems/tools/useModifyToolActivation';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { ScaleToolStore } from '../../systems/scale/ScaleToolStore';
import { computeUniformRef, referenceDistance, computeLiveScale } from '../../systems/scale/scale-reference-calc';
import { isScalableEntityType } from '../../systems/scale/scale-entity-transform';
import type { ScaleSubPhase } from '../../systems/scale/ScaleToolStore';
import { GripHandoffStore } from '../../systems/grip/GripHandoffStore';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseScaleToolProps {
  activeTool: string;
  selectedEntityIds: string[];
  levelManager: SceneAdapterLevelManager;
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

interface SelectionPartition {
  workable: string[];
  /** On a locked layer → skipped (ADR-348). */
  lockedSkipped: number;
  /** Parametric BIM / unsupported type → skipped with an explicit message (ADR-646 #3). */
  unsupportedSkipped: number;
}

// Single scene pass splitting the selection into what SCALE will act on vs what it skips, so the
// user gets an explicit reason instead of a silent no-op on BIM/parametric entities (Revit-grade).
function partitionSelection(
  ids: string[],
  getLevelScene: SceneAdapterLevelManager['getLevelScene'],
  levelId: string | null,
): SelectionPartition {
  if (!levelId) return { workable: ids, lockedSkipped: 0, unsupportedSkipped: 0 };
  const scene = getLevelScene(levelId);
  if (!scene) return { workable: ids, lockedSkipped: 0, unsupportedSkipped: 0 };
  const workable: string[] = [];
  const layers = scene.layersById ?? {};
  let lockedSkipped = 0;
  let unsupportedSkipped = 0;
  for (const id of ids) {
    const entity = scene.entities.find(e => e.id === id);
    const layer = entity?.layerId ? layers[entity.layerId] : undefined;
    if (layer?.locked) { lockedSkipped++; continue; }
    if (entity && !isScalableEntityType(entity.type)) { unsupportedSkipped++; continue; }
    workable.push(id);
  }
  return { workable, lockedSkipped, unsupportedSkipped };
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

  const isActive = activeTool === 'scale';
  const state = ScaleToolStore.getState();
  const isCollectingInput = isActive && (state.phase === 'base_point' || state.phase === 'scale_input');

  const getSceneManager = useSceneManagerAdapter(levelManager);

  // ── State machine transitions ─────────────────────────────────────────────

  // ── State machine transitions (shared FSM SSoT, ADR-577) ──────────────────
  // Store-backed phase (`ScaleToolStore`): `setPhase`/`onDeactivate` delegate to
  // it. The store's selected-id snapshot is refreshed on every activate + on the
  // entity→base advance. The grip-drag handoff (pre-seeded base point, optional
  // reference vector) is the tool-specific ACTIVATE variant (`onActivate`).
  useModifyToolActivation({
    isActive,
    selectionCount: selectedEntityIds.length,
    phase: state.phase,
    entityPhase: 'selecting',
    basePhase: 'base_point',
    setPhase: (p) => {
      previewCanvasRef.current?.clear();
      if (p === 'base_point') ScaleToolStore.setSelectedEntityIds(selectedEntityIds);
      ScaleToolStore.setPhase(p as typeof state.phase);
    },
    onDeactivate: () => {
      ScaleToolStore.reset();
      previewCanvasRef.current?.clear();
    },
    onActivate: (hasSelection) => {
      ScaleToolStore.setSelectedEntityIds(selectedEntityIds);
      const handoff = GripHandoffStore.consume('scale');
      if (hasSelection && handoff) {
        ScaleToolStore.setBasePoint(handoff.point);
        if (handoff.options.copyMode) ScaleToolStore.setCopyMode(true);
        if (handoff.options.refStart && handoff.options.refEnd) {
          ScaleToolStore.setRefPoint('refP1x', handoff.options.refStart);
          ScaleToolStore.setRefPoint('refP2x', handoff.options.refEnd);
          ScaleToolStore.setPhase('scale_input', 'ref_new_x');
        } else {
          ScaleToolStore.setPhase('scale_input', 'direct');
        }
        previewCanvasRef.current?.clear();
        return true;
      }
      return false; // default (hasSelection ? base_point : selecting) via setPhase
    },
  });

  // ── Execute ───────────────────────────────────────────────────────────────

  const executeScale = useCallback((sx: number, sy: number) => {
    const s = ScaleToolStore.getState();
    if (!s.basePoint) return;
    if (sx === 0 || sy === 0) {
      toolHintOverrideStore.setOverride(i18next.t('tool-hints:scaleTool.invalidZeroFactor'));
      return;
    }

    const { workable, lockedSkipped, unsupportedSkipped } = partitionSelection(
      s.selectedEntityIds,
      levelManager.getLevelScene,
      levelManager.currentLevelId,
    );

    if (workable.length === 0) {
      // Prefer the "cannot be scaled" reason when nothing was merely locked (ADR-646 #3).
      const abortKey = unsupportedSkipped > 0 && lockedSkipped === 0
        ? 'scaleTool.allUnsupportedAbort'
        : 'scaleTool.allLockedAbort';
      toolHintOverrideStore.setOverride(i18next.t(`tool-hints:${abortKey}`));
      ScaleToolStore.reset();
      previewCanvasRef.current?.clear();
      onToolChange?.('select');
      return;
    }

    // Partial skip: surface the more actionable message (unsupported takes priority over locked).
    if (unsupportedSkipped > 0) {
      toolHintOverrideStore.setOverride(
        i18next.t('tool-hints:scaleTool.scaleUnsupportedSkipped', { count: unsupportedSkipped }),
      );
    } else if (lockedSkipped > 0) {
      toolHintOverrideStore.setOverride(
        i18next.t('tool-hints:scaleTool.lockedLayerSkipped', { count: lockedSkipped }),
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
      ScaleToolStore.setDragRefPoint(null); // fresh drag reference (captured by the preview)
      // Honour a non-uniform mode armed from the ribbon tab before the base-point
      // pick (ADR-646 Φ4 #6): go straight to the X sub-phase so the tool collects
      // X then Y instead of a single live factor.
      ScaleToolStore.setPhase('scale_input', s.nonUniformMode ? 'direct_x' : 'direct');
      return;
    }

    if (s.phase !== 'scale_input') return;

    // ADR-646 #1 — direct drag: a click locks the live factor (AutoCAD drag-to-scale parity).
    // Requires an established drag reference, so a stray click without movement is ignored.
    if (s.subPhase === 'direct') {
      if (!s.basePoint || !s.dragRefPoint) return;
      const live = computeLiveScale(s, worldPoint, s.basePoint);
      executeScale(live, live);
      return;
    }

    routeReferenceClick(s, worldPoint, executeScale);
  }, [isActive, executeScale]);

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

  // ── Ribbon factor commit-sink (ADR-646 Φ4 #6) ──────────────────────────────
  // Register `executeScale` so the contextual «Κλιμάκωση» tab's factor field can
  // commit the SAME uniform scale as typed-Enter (the store has no scene-manager
  // access). Cleared on deactivate so a stale executor never fires post-teardown.
  useEffect(() => {
    if (!isActive) return;
    ScaleToolStore.setCommitSink(executeScale);
    return () => ScaleToolStore.setCommitSink(null);
  }, [isActive, executeScale]);

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

function routeReferenceClick(
  s: ReturnType<typeof ScaleToolStore.getState>,
  pt: Point2D,
  executeScale: (sx: number, sy: number) => void,
): void {
  const { subPhase, basePoint } = s;
  switch (subPhase) {
    case 'ref_p1_x': ScaleToolStore.setRefPoint('refP1x', pt); ScaleToolStore.setSubPhase('ref_p2_x'); break;
    case 'ref_p2_x': ScaleToolStore.setRefPoint('refP2x', pt); ScaleToolStore.setSubPhase('ref_new_x'); break;
    case 'ref_p1_y': ScaleToolStore.setRefPoint('refP1y', pt); ScaleToolStore.setSubPhase('ref_p2_y'); break;
    case 'ref_p2_y': ScaleToolStore.setRefPoint('refP2y', pt); ScaleToolStore.setSubPhase('ref_new_y'); break;
    // ADR-646 #2 — new length by pick: measured from the base point to the clicked point.
    case 'ref_new_x': if (basePoint) confirmRefNewX(s, referenceDistance(basePoint, pt), executeScale); break;
    case 'ref_new_y': if (basePoint) confirmRefNewY(s, referenceDistance(basePoint, pt), executeScale); break;
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

  // Typed and picked new-length share the SAME reference math (SSoT) — only the source differs.
  if (subPhase === 'ref_new_x') return confirmRefNewX(s, val, executeScale);
  if (subPhase === 'ref_new_y') return confirmRefNewY(s, val, executeScale);

  return false;
}

// ── Reference new-length confirm (shared by typed Enter + point pick) ──────────

function confirmRefNewX(
  s: ReturnType<typeof ScaleToolStore.getState>,
  newLength: number,
  executeScale: (sx: number, sy: number) => void,
): boolean {
  const { refP1x, refP2x, nonUniformMode } = s;
  if (!refP1x || !refP2x) return false;
  const sx = computeUniformRef(refP1x, refP2x, newLength);
  if (sx === null) return false;
  if (!nonUniformMode) { executeScale(sx, sx); return true; }
  ScaleToolStore.setFactors(sx, s.currentSy);
  ScaleToolStore.setSubPhase('ref_p1_y');
  return true;
}

function confirmRefNewY(
  s: ReturnType<typeof ScaleToolStore.getState>,
  newLength: number,
  executeScale: (sx: number, sy: number) => void,
): boolean {
  const { refP1y, refP2y, currentSx } = s;
  if (!refP1y || !refP2y) return false;
  const sy = computeUniformRef(refP1y, refP2y, newLength);
  if (sy === null) return false;
  executeScale(currentSx, sy);
  return true;
}

function parseNumericBuffer(buf: string): number | null {
  if (!buf) return null;
  const n = parseFloat(buf);
  return isNaN(n) ? null : n;
}
