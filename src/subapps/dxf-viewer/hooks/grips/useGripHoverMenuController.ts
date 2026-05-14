/**
 * USE GRIP HOVER MENU CONTROLLER — ADR-349 Phase 1b.2
 *
 * Connects the unified grip interaction's `hoveredGrip` state to the
 * {@link GripHoverMenuStore} via a hold-time timer (industry standard
 * 400ms, matching the Windows native ToolTip delay) with Ctrl as a
 * bypass modifier (held = menu suppressed).
 *
 * ADR-040 compliant: this hook only writes to a LOW-frequency store and
 * runs `useEffect` against discrete inputs — it does NOT subscribe to any
 * 60fps store. Safe to invoke from CanvasSection.
 *
 * @see GripHoverMenuStore
 * @see grip-menu-resolver
 * @see grip-menu-actions
 */

import { useEffect, useRef } from 'react';
import type { ICommand, ISceneManager } from '../../core/commands/interfaces';
import type { UnifiedGripInfo, UnifiedGripPhase } from './unified-grip-types';
import type { PromptDialogOptions } from '../../systems/prompt-dialog';
import type { useLevels } from '../../systems/levels';
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { ImmediatePositionStore } from '../../systems/cursor/ImmediatePositionStore';
import { GripHoverMenuStore, type GripMenuOption } from '../../systems/grip/GripHoverMenuStore';
import { resolveMenuActions } from '../../systems/grip/grip-menu-resolver';
import { bindMenuAction, type GripMenuActionContext } from '../../systems/grip/grip-menu-actions';

/** Hold-time before the menu pops, in ms. Matches Windows ToolTip default. */
const MENU_HOLD_MS = 400;

/** Menu offset from grip cursor, in px (down-right, like Windows context menu). */
const MENU_OFFSET_PX = { x: 12, y: 12 } as const;

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseGripHoverMenuControllerParams {
  readonly hoveredGrip: UnifiedGripInfo | null;
  readonly phase: UnifiedGripPhase;
  readonly activeTool: string;
  readonly levelManager: LevelManagerLike;
  readonly executeCommand: (cmd: ICommand) => void;
  readonly showPromptDialog: (opts: PromptDialogOptions) => Promise<string | null>;
  readonly t: (key: string, params?: Record<string, unknown>) => string;
}

export function useGripHoverMenuController(params: UseGripHoverMenuControllerParams): void {
  const {
    hoveredGrip, phase, activeTool,
    levelManager, executeCommand, showPromptDialog, t,
  } = params;

  const ctrlDownRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Ctrl bypass: track modifier state at the window level ───────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        ctrlDownRef.current = true;
        GripHoverMenuStore.hide();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') ctrlDownRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // ── Main: hovered grip → store transition with hold-timer ───────────────
  useEffect(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }

    const isGripMode = activeTool === 'select' || activeTool === 'layering';
    if (!isGripMode || phase === 'dragging' || !hoveredGrip || ctrlDownRef.current) {
      GripHoverMenuStore.hide();
      return;
    }
    if (hoveredGrip.source !== 'dxf' || !hoveredGrip.entityId) {
      GripHoverMenuStore.hide();
      return;
    }
    const entityId = hoveredGrip.entityId;
    const levelId = levelManager.currentLevelId;
    if (!levelId) { GripHoverMenuStore.hide(); return; }
    const scene = levelManager.getLevelScene(levelId);
    const entity = scene?.entities.find((e) => e.id === entityId);
    if (!entity) { GripHoverMenuStore.hide(); return; }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (ctrlDownRef.current) return;

      const sceneManager: ISceneManager = new LevelSceneManagerAdapter(
        levelManager.getLevelScene, levelManager.setLevelScene, levelId,
      );
      const ctx: GripMenuActionContext = {
        executeCommand, sceneManager, showPromptDialog, t,
        onAfterDispatch: () => GripHoverMenuStore.hide(),
      };

      const actions = resolveMenuActions(entity, hoveredGrip);
      const options: GripMenuOption[] = [];
      for (const meta of actions) {
        const onSelect = bindMenuAction(meta.id, entity, hoveredGrip, ctx);
        if (!onSelect) continue;
        options.push({ id: meta.id, labelKey: meta.labelKey, onSelect });
      }
      if (options.length === 0) return;

      const screenPos = ImmediatePositionStore.getPosition();
      if (!screenPos) return;
      GripHoverMenuStore.show({
        grip: hoveredGrip,
        screenPos: { x: screenPos.x + MENU_OFFSET_PX.x, y: screenPos.y + MENU_OFFSET_PX.y },
        options,
      });
    }, MENU_HOLD_MS);

    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [hoveredGrip, phase, activeTool, levelManager, executeCommand, showPromptDialog, t]);

  // ── Unmount cleanup ─────────────────────────────────────────────────────
  useEffect(() => () => {
    GripHoverMenuStore.hide();
  }, []);
}
