/**
 * USE GRIP HOVER MENU CONTROLLER — ADR-349 Phase 1b.2
 *
 * Connects the unified grip interaction's `hoveredGrip` state to the
 * {@link GripHoverMenuStore} via a hold-time timer (industry standard
 * 400ms, matching the Windows native ToolTip delay) with Ctrl as a
 * bypass modifier (held = menu suppressed).
 *
 * ## Positioning fix (2026-05-22)
 * Menu position uses `clientX/clientY` captured at hover START — NOT
 * `ImmediatePositionStore.getPosition()` which returns canvas-relative coords
 * (`clientX - rect.left`). `position: fixed` CSS requires viewport coords.
 *
 * ## Dismiss fix (2026-05-22)
 * When `hoveredGrip` becomes null (cursor moves off grip toward the menu),
 * the menu is NOT closed — the user needs to reach the menu items to click
 * them. Only hides on: drag start, Ctrl press, new-grip hover, or outside-click
 * (handled by the component).
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
import { GripHoverMenuStore, type GripMenuOption } from '../../systems/grip/GripHoverMenuStore';
import { getClientPosition } from '../../systems/cursor/ImmediatePositionStore';
import { resolveMenuActions } from '../../systems/grip/grip-menu-resolver';
import { bindMenuAction, type GripMenuActionContext } from '../../systems/grip/grip-menu-actions';

/** Hold-time before the menu pops, in ms. Matches Windows ToolTip default. */
const MENU_HOLD_MS = 400;

/** Menu offset from cursor (viewport px), down-right like Windows context menu. */
const MENU_OFFSET_PX = { x: 14, y: 14 } as const;

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

    // Always close on drag start (grip is being moved — menu is irrelevant).
    if (phase === 'dragging') {
      GripHoverMenuStore.hide();
      return;
    }

    // If the menu is already visible and the cursor just moved off the grip
    // (hoveredGrip became null), the user is likely moving toward the menu to
    // click an item — do NOT close it. The outside-click handler in the
    // component closes it when the user clicks anywhere outside the menu.
    if (GripHoverMenuStore.getSnapshot().visible) {
      if (!hoveredGrip) return; // Keep open while cursor travels to menu
      // Cursor moved to a NEW grip — close and restart timer below.
      GripHoverMenuStore.hide();
    }

    const isGripMode = activeTool === 'select' || activeTool === 'layering';
    if (!isGripMode || ctrlDownRef.current || !hoveredGrip) return;
    if (hoveredGrip.source !== 'dxf' || !hoveredGrip.entityId) return;

    const entityId = hoveredGrip.entityId;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;
    const scene = levelManager.getLevelScene(levelId);
    const entity = scene?.entities.find((e) => e.id === entityId);
    if (!entity) return;

    // Capture viewport position NOW (at hover start) — used for menu placement.
    const startClientPos = getClientPosition();

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

      GripHoverMenuStore.show({
        grip: hoveredGrip,
        screenPos: { x: startClientPos.x + MENU_OFFSET_PX.x, y: startClientPos.y + MENU_OFFSET_PX.y },
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
