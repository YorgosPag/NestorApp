/**
 * USE STAIR ADD-TURN TOOL — ADR-633 Sub-phase 1b-ii (multi-flight turn points).
 *
 * Revit-style «edit the selected stair» pick tool: with a straight / multi-flight
 * stair selected, the contextual-ribbon button activates `'stair-add-turn'` → the
 * user clicks one of the stair's two parietes (sides) in plan → a turn-angle
 * prompt (default 90°) → the run gains a direction change at that point (landing
 * corner, Phase 1). The clicked side maps straight to the turn direction (right
 * parieta → right turn).
 *
 * This hook is ONLY the wiring. It mirrors `useWallAttachTool` (the canonical
 * pick-on-selected modify tool): activation snapshots the selected stair id, a
 * canvas click resolves the parieta via the pure `pickStairParieta` SSoT, the
 * angle comes from the shared `showPromptDialog` (the same dialog the rotation
 * tool uses), and the edit commits atomically through `UpdateStairParamsCommand`
 * (geometry + validation recomputed, one undo entry). The interaction math
 * (`pickStairParieta` / `insertTurnAtParieta`) is reused as-is — zero duplication.
 *
 * Units: stair params live in SCENE units (ADR-393 §C), same frame as the world
 * click point, so no mm conversion is needed for the hit-test.
 *
 * @see bim/stairs/stair-parieta-pick.ts — parieta hit-test SSoT
 * @see bim/stairs/stair-turn-insert.ts — StairParams transform SSoT
 * @see hooks/tools/useWallAttachTool.ts — the pick-on-selected pattern mirrored here
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md
 */
'use client';

import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import i18next from 'i18next';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import type { StairEntity } from '../../bim/types/stair-types';
import {
  useSceneManagerAdapter,
  type SceneAdapterLevelManager,
} from '../../systems/entity-creation/useSceneManagerAdapter';
import { pickStairParieta, type StairParietaPick } from '../../bim/stairs/stair-parieta-pick';
import { insertTurnAtParieta } from '../../bim/stairs/stair-turn-insert';
import { UpdateStairParamsCommand } from '../../core/commands/entity-commands/UpdateStairParamsCommand';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { useEdgeTriggeredLifecycle } from './useEdgeTriggeredLifecycle';
import type { PromptDialogOptions } from '../../systems/prompt-dialog/prompt-dialog-store';

const DEFAULT_TURN_ANGLE_DEG = 90;

export interface UseStairAddTurnToolProps {
  activeTool: string;
  selectedEntityIds: string[];
  levelManager: SceneAdapterLevelManager;
  executeCommand: (cmd: ICommand) => void;
  onToolChange?: (tool: string) => void;
  showPromptDialog: (opts: PromptDialogOptions) => Promise<string | null>;
  t: (key: string) => string;
}

export interface UseStairAddTurnToolReturn {
  isActive: boolean;
  handleStairAddTurnClick: (worldPoint: Point2D) => void;
  handleStairAddTurnEscape: () => void;
}

export function useStairAddTurnTool({
  activeTool,
  selectedEntityIds,
  levelManager,
  executeCommand,
  onToolChange,
  showPromptDialog,
  t,
}: UseStairAddTurnToolProps): UseStairAddTurnToolReturn {
  const isActive = activeTool === 'stair-add-turn';
  const getSceneManager = useSceneManagerAdapter(levelManager);

  /** Stair id under edit, snapshotted on activation. */
  const stairIdRef = useRef<string | null>(null);
  /** Guards re-entrant clicks while the modal angle prompt is open. */
  const promptOpenRef = useRef(false);

  const resolveSelectedStairId = useCallback((): string | null => {
    const scene = levelManager.currentLevelId
      ? levelManager.getLevelScene(levelManager.currentLevelId)
      : null;
    if (!scene?.entities) return null;
    const selected = new Set(selectedEntityIds);
    const stair = scene.entities.find(
      (e) => selected.has(e.id) && (e as { type?: string }).type === 'stair',
    );
    return stair?.id ?? null;
  }, [levelManager, selectedEntityIds]);

  // Snapshot the target on activation; exit immediately if no stair is selected.
  // Closure reads at the transition render match the wall-attach edge pattern.
  useEdgeTriggeredLifecycle(
    isActive,
    () => {
      const stairId = resolveSelectedStairId();
      stairIdRef.current = stairId;
      if (!stairId) {
        onToolChange?.('select');
      } else {
        toolHintOverrideStore.setOverride(
          i18next.t('stairAddTurn.pickParietaPrompt', { ns: 'dxf-viewer-shell' }),
        );
      }
    },
    () => {
      stairIdRef.current = null;
      promptOpenRef.current = false;
      toolHintOverrideStore.setOverride(null);
    },
  );

  // ── Angle prompt (shared rotation-style dialog, default 90°) ──────────────
  const promptTurnAngle = useCallback(async (): Promise<number | null> => {
    const result = await showPromptDialog({
      title: t('promptDialog.turnAngle'),
      label: t('promptDialog.enterTurnAngle'),
      placeholder: t('promptDialog.turnAnglePlaceholder'),
      defaultValue: String(DEFAULT_TURN_ANGLE_DEG),
      inputType: 'number',
      unit: '°',
      validate: (val) => (isNaN(parseFloat(val)) ? t('promptDialog.invalidNumber') : null),
    });
    if (result === null) return null;
    const angle = parseFloat(result);
    return Number.isFinite(angle) ? angle : null;
  }, [showPromptDialog, t]);

  // ── Commit: re-read live stair (may have changed while modal was open) ─────
  const commitTurn = useCallback(
    (stairId: string, pick: StairParietaPick, angle: number): void => {
      const sm = getSceneManager();
      const raw = sm?.getEntity(stairId) as unknown as Partial<StairEntity> | null;
      if (!sm || !raw || raw.type !== 'stair' || !raw.params) return;
      const stair = raw as StairEntity;
      const newParams = insertTurnAtParieta(stair.params, {
        flightIndex: pick.flightIndex,
        param: pick.param,
        side: pick.side,
        turnAngleDeg: angle,
      });
      if (!newParams) {
        toast.warning(i18next.t('stairAddTurn.branchTooShort', { ns: 'dxf-viewer-shell' }));
        return;
      }
      executeCommand(new UpdateStairParamsCommand(stairId, newParams, stair.params, sm, false));
    },
    [getSceneManager, executeCommand],
  );

  // ── Click: hit-test the parieta → prompt angle → commit → back to select ──
  const handleStairAddTurnClick = useCallback(
    (worldPoint: Point2D): void => {
      if (!isActive || promptOpenRef.current) return;
      const stairId = stairIdRef.current;
      if (!stairId) return;
      const sm = getSceneManager();
      const raw = sm?.getEntity(stairId) as unknown as Partial<StairEntity> | null;
      if (!sm || !raw || raw.type !== 'stair' || !raw.params) return;
      const tol = TOLERANCE_CONFIG.SNAP_DEFAULT / getImmediateTransform().scale;
      const pick = pickStairParieta(worldPoint, (raw as StairEntity).params, tol);
      if (!pick) return; // missed the stair — stay in pick mode

      promptOpenRef.current = true;
      void promptTurnAngle().then((angle) => {
        promptOpenRef.current = false;
        if (angle !== null) commitTurn(stairId, pick, angle);
        onToolChange?.('select');
      });
    },
    [isActive, getSceneManager, promptTurnAngle, commitTurn, onToolChange],
  );

  const handleStairAddTurnEscape = useCallback((): void => {
    toolHintOverrideStore.setOverride(null);
    onToolChange?.('select');
  }, [onToolChange]);

  return { isActive, handleStairAddTurnClick, handleStairAddTurnEscape };
}
