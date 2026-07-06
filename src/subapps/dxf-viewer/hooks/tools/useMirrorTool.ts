/**
 * USE MIRROR TOOL — AutoCAD-style 2-click axis definition for entity mirroring
 *
 * State machine:
 *   idle → awaiting-entity → awaiting-first-point → awaiting-second-point → awaiting-keep-originals → (execute) → awaiting-first-point
 *
 * When activeTool === 'mirror':
 *   - Entities already selected → skip to awaiting-first-point
 *   - No entities → awaiting-entity (clicks pass through for normal selection)
 *   - Click first axis point → awaiting-second-point
 *   - Click second axis point → awaiting-keep-originals (Y = keep, N = discard originals)
 *   - Y key → execute with keepOriginals=true, N key → execute with keepOriginals=false
 *   - Escape → clear, switch to 'select'
 *
 * @module hooks/tools/useMirrorTool
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import i18next from 'i18next';
import { GripHandoffStore } from '../../systems/grip/GripHandoffStore';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas/PreviewCanvas';
import { MirrorEntityCommand } from '../../core/commands/entity-commands/MirrorEntityCommand';
import { useSceneManagerAdapter, type SceneAdapterLevelManager } from '../../systems/entity-creation/useSceneManagerAdapter';
import { useModifyToolActivation } from '../../systems/tools/useModifyToolActivation';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { useCadToggles } from '../common/useCadToggles';
import { orthoSnap } from '../../utils/mirror-math';

// ============================================================================
// TYPES
// ============================================================================

export type MirrorPhase =
  | 'idle'
  | 'awaiting-entity'
  | 'awaiting-first-point'
  | 'awaiting-second-point'
  | 'awaiting-keep-originals';

export interface UseMirrorToolProps {
  activeTool: string;
  selectedEntityIds: string[];
  levelManager: SceneAdapterLevelManager;
  executeCommand: (cmd: ICommand) => void;
  previewCanvasRef: React.RefObject<PreviewCanvasHandle | null>;
  onToolChange?: (tool: string) => void;
}

export interface UseMirrorToolReturn {
  phase: MirrorPhase;
  firstPoint: Point2D | null;
  secondPoint: Point2D | null;
  isActive: boolean;
  isCollectingInput: boolean;
  handleMirrorClick: (worldPoint: Point2D) => void;
  handleMirrorEscape: () => void;
  handleMirrorConfirm: (keepOriginals: boolean) => void;
  prompt: string;
}

// ============================================================================
// HOOK
// ============================================================================

export function useMirrorTool(props: UseMirrorToolProps): UseMirrorToolReturn {
  const {
    activeTool,
    selectedEntityIds,
    levelManager,
    executeCommand,
    previewCanvasRef,
    onToolChange,
  } = props;

  const [phase, setPhase] = useState<MirrorPhase>('idle');
  const [firstPoint, setFirstPoint] = useState<Point2D | null>(null);
  const [secondPoint, setSecondPoint] = useState<Point2D | null>(null);

  const { ortho } = useCadToggles();
  const orthoOnRef = useRef(ortho.on);
  orthoOnRef.current = ortho.on;
  const shiftHeldRef = useRef(false);

  // ADR-357 Phase 12 — armed when the grip drag handoff carried `copyMode:true`.
  // On second-point click we auto-confirm with `keepOriginals=true` and skip
  // the manual Y/N prompt (which would otherwise interrupt the grip flow).
  const copyModeHandoffRef = useRef(false);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftHeldRef.current = true; };
    const onUp = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftHeldRef.current = false; };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  const isActive = activeTool === 'mirror';
  const isCollectingInput = isActive && selectedEntityIds.length > 0
    && (phase === 'awaiting-first-point' || phase === 'awaiting-second-point' || phase === 'awaiting-keep-originals');

  const getSceneManager = useSceneManagerAdapter(levelManager);

  // ── State machine transitions (shared FSM SSoT, ADR-577) ──────────────────
  // Every hook-driven phase change clears the ghost + drops stale axis points.
  // The grip-drag handoff (pre-seeded first axis point → jump to second point)
  // is the tool-specific ACTIVATE variant, handled in `onActivate`.
  useModifyToolActivation({
    isActive,
    selectionCount: selectedEntityIds.length,
    phase,
    entityPhase: 'awaiting-entity',
    basePhase: 'awaiting-first-point',
    setPhase: (p) => {
      previewCanvasRef.current?.clear();
      if (p === 'awaiting-entity' || p === 'awaiting-first-point') { setFirstPoint(null); setSecondPoint(null); }
      setPhase(p as MirrorPhase);
    },
    onDeactivate: () => {
      previewCanvasRef.current?.clear();
      setPhase('idle'); setFirstPoint(null); setSecondPoint(null);
    },
    onActivate: (hasSelection) => {
      const handoff = GripHandoffStore.consume('mirror');
      if (hasSelection && handoff) {
        previewCanvasRef.current?.clear();
        setFirstPoint(handoff.point);
        setSecondPoint(null);
        copyModeHandoffRef.current = handoff.options.copyMode === true;
        setPhase('awaiting-second-point');
        return true;
      }
      copyModeHandoffRef.current = false;
      return false; // default (hasSelection ? first-point : entity) resets points via setPhase
    },
  });

  const handleMirrorClick = useCallback((worldPoint: Point2D) => {
    if (!isCollectingInput) return;

    if (phase === 'awaiting-first-point') {
      setFirstPoint(worldPoint);
      setPhase('awaiting-second-point');
      return;
    }

    if (phase === 'awaiting-second-point' && firstPoint) {
      const snapped = (orthoOnRef.current || shiftHeldRef.current)
        ? orthoSnap(firstPoint, worldPoint)
        : worldPoint;
      const dx = snapped.x - firstPoint.x;
      const dy = snapped.y - firstPoint.y;
      if (dx * dx + dy * dy < 1e-10) return;

      setSecondPoint(snapped);
      setPhase('awaiting-keep-originals');

      // ADR-357 Phase 12 — auto-confirm when the grip handoff carried
      // `copyMode:true`. Skips the manual Y/N prompt and runs the mirror with
      // `keepOriginals=true` immediately (`secondPoint` setState is async so
      // we pass the snapped value directly to a synchronous executor).
      if (copyModeHandoffRef.current) {
        copyModeHandoffRef.current = false;
        const sm = getSceneManager();
        if (sm) {
          const cmd = new MirrorEntityCommand(
            selectedEntityIds,
            { p1: firstPoint, p2: snapped },
            true,
            sm,
          );
          executeCommand(cmd);
          previewCanvasRef.current?.clear();
          setPhase('awaiting-first-point');
          setFirstPoint(null);
          setSecondPoint(null);
        }
      }
    }
  }, [isCollectingInput, phase, firstPoint, getSceneManager, selectedEntityIds, executeCommand, previewCanvasRef]);

  const handleMirrorConfirm = useCallback((keepOriginals: boolean) => {
    if (phase !== 'awaiting-keep-originals' || !firstPoint || !secondPoint) return;

    const sm = getSceneManager();
    if (!sm) return;

    const cmd = new MirrorEntityCommand(
      selectedEntityIds,
      { p1: firstPoint, p2: secondPoint },
      keepOriginals,
      sm,
    );
    executeCommand(cmd);

    previewCanvasRef.current?.clear();
    setPhase('awaiting-first-point');
    setFirstPoint(null);
    setSecondPoint(null);
  }, [phase, firstPoint, secondPoint, getSceneManager, selectedEntityIds, executeCommand, previewCanvasRef]);

  const handleMirrorEscape = useCallback(() => {
    previewCanvasRef.current?.clear();
    setPhase('idle');
    setFirstPoint(null);
    setSecondPoint(null);
    onToolChange?.('select');
  }, [previewCanvasRef, onToolChange]);

  let prompt = '';
  if (phase === 'awaiting-entity') {
    prompt = i18next.t('dxf-viewer-guides:mirrorTool.selectEntity');
  } else if (phase === 'awaiting-first-point') {
    prompt = i18next.t('dxf-viewer-guides:mirrorTool.selectFirstPoint');
  } else if (phase === 'awaiting-second-point') {
    prompt = i18next.t('dxf-viewer-guides:mirrorTool.selectSecondPoint');
  } else if (phase === 'awaiting-keep-originals') {
    prompt = i18next.t('dxf-viewer-guides:mirrorTool.keepOriginals');
  }

  useEffect(() => {
    if (!isActive || phase === 'idle') {
      toolHintOverrideStore.setOverride(null);
      return;
    }
    toolHintOverrideStore.setOverride(prompt);
    return () => { toolHintOverrideStore.setOverride(null); };
  }, [isActive, phase, prompt]);

  return {
    phase,
    firstPoint,
    secondPoint,
    isActive,
    isCollectingInput,
    handleMirrorClick,
    handleMirrorEscape,
    handleMirrorConfirm,
    prompt,
  };
}
