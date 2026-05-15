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
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { useCadToggles } from '../common/useCadToggles';
import { orthoSnap } from '../../utils/mirror-math';
import type { useLevels } from '../../systems/levels';

// ============================================================================
// TYPES
// ============================================================================

export type MirrorPhase =
  | 'idle'
  | 'awaiting-entity'
  | 'awaiting-first-point'
  | 'awaiting-second-point'
  | 'awaiting-keep-originals';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseMirrorToolProps {
  activeTool: string;
  selectedEntityIds: string[];
  levelManager: LevelManagerLike;
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

  const wasActiveRef = useRef(false);
  const prevEntityCountRef = useRef(0);

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
    const toolIsMirror = activeTool === 'mirror';
    const hasEntities = selectedEntityIds.length > 0;

    if (toolIsMirror && !wasActiveRef.current) {
      const handoffPt = GripHandoffStore.consume('mirror');
      if (hasEntities && handoffPt) {
        // Grip drag pre-seeded the first axis point → skip straight to second point
        setFirstPoint(handoffPt);
        setSecondPoint(null);
        setPhase('awaiting-second-point');
      } else {
        setPhase(hasEntities ? 'awaiting-first-point' : 'awaiting-entity');
        setFirstPoint(null);
        setSecondPoint(null);
      }
      previewCanvasRef.current?.clear();
    } else if (!toolIsMirror && wasActiveRef.current) {
      setPhase('idle');
      setFirstPoint(null);
      setSecondPoint(null);
      previewCanvasRef.current?.clear();
    } else if (toolIsMirror && wasActiveRef.current) {
      const prevCount = prevEntityCountRef.current;
      if (prevCount === 0 && hasEntities && phase === 'awaiting-entity') {
        setPhase('awaiting-first-point');
        previewCanvasRef.current?.clear();
      }
    }

    wasActiveRef.current = toolIsMirror;
    prevEntityCountRef.current = selectedEntityIds.length;
  }, [activeTool, selectedEntityIds.length, phase, previewCanvasRef]);

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
    }
  }, [isCollectingInput, phase, firstPoint]);

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
