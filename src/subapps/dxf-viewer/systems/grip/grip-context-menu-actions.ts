/**
 * GRIP CONTEXT MENU ACTIONS — ADR-357 Phase 11 / G10.A + Phase 12 / G10 extras
 *
 * Action dispatcher that turns a resolved {@link GripContextActionId} into a
 * bound `onSelect` callback. No React, no DOM. Receives a context with the
 * setters / arming hooks needed by each action family:
 *
 *   - `mode:*`             → set {@link GripModeStore} → update tool hint
 *   - `exit`               → call `ctx.handleEscape` (cancel active drag)
 *   - `extras:basePoint`   → arm {@link GripBasePointStore} pick + status hint
 *   - `extras:copyToggle`  → toggle {@link GripCopyModeStore} + status hint
 *   - `extras:reference`   → arm {@link GripReferenceStore} pick (Scale/Rotate)
 *   - `extras:sessionUndo` → call `ctx.sessionUndo` (delegates to CommandHistory)
 *
 * @see grip-context-menu-resolver — pure resolver
 * @see GripContextMenuStore       — UI state container
 * @see GripModeStore              — mode SSoT consumed by `commitDxfGripDragModeAware`
 * @see GripBasePointStore         — Base Point override anchor SSoT
 * @see GripCopyModeStore          — Copy toggle SSoT
 * @see GripReferenceStore         — Reference pick SSoT
 * @see GripSessionUndoStore       — Session-scoped undo SSoT
 */

import i18next from 'i18next';
import { GripModeStore } from './GripModeStore';
import { gripModeMeta, type GripMode } from './grip-mode-cycle';
import { toolHintOverrideStore } from '../../hooks/toolHintOverrideStore';
import { GripBasePointStore } from './GripBasePointStore';
import { GripCopyModeStore } from './GripCopyModeStore';
import { GripReferenceStore } from './GripReferenceStore';
import type { UnifiedGripInfo } from '../../hooks/grips/unified-grip-types';
import type {
  GripContextActionId,
  GripContextActionMeta,
} from './grip-context-menu-resolver';

export interface GripContextActionBindContext {
  /** Cancel the active grip drag (mirror of `useUnifiedGripInteraction.handleEscape`). */
  readonly handleEscape: () => void;
  /** Close the context menu after dispatch — usually `GripContextMenuStore.hide`. */
  readonly onAfterDispatch: () => void;
  /** ADR-357 Phase 12 — run a session-scoped undo (delegates to `CommandHistory.undo`). */
  readonly sessionUndo: () => void;
  /**
   * ADR-363 Phase 3.8 — callback for slab vertex operations triggered from the
   * context menu. `'delete-corner'` removes the vertex; `'add-corner'` inserts at
   * edge midpoint (delta = 0). Provided by `useGripContextMenuController`.
   */
  readonly onSlabVertexOp?: (grip: UnifiedGripInfo, op: 'delete-corner' | 'add-corner') => void;
}

function updateModeHint(): void {
  const meta = gripModeMeta(GripModeStore.getSnapshot());
  const modeLabel = i18next.t(`tool-hints:${meta.labelKey}`);
  const cycleHint = i18next.t('tool-hints:gripMode.cycleHint', { mode: modeLabel });
  toolHintOverrideStore.setOverride(cycleHint);
}

function actionSetMode(mode: GripMode, ctx: GripContextActionBindContext): void {
  GripModeStore.set(mode);
  updateModeHint();
  ctx.onAfterDispatch();
}

function actionExit(ctx: GripContextActionBindContext): void {
  ctx.handleEscape();
  ctx.onAfterDispatch();
}

function actionBasePoint(ctx: GripContextActionBindContext): void {
  GripBasePointStore.armBasePointPick();
  // Status-bar prompt: next click on the canvas captures the new anchor. The
  // pick is consumed in `useUnifiedGripInteraction.handleMouseDown` when
  // pickPhase === 'awaiting-click'.
  toolHintOverrideStore.setOverride(
    i18next.t('tool-hints:gripContextMenu.prompts.pickBasePoint'),
  );
  ctx.onAfterDispatch();
}

function actionCopyToggle(ctx: GripContextActionBindContext): void {
  GripCopyModeStore.toggle();
  const enabled = GripCopyModeStore.getSnapshot().enabled;
  toolHintOverrideStore.setOverride(
    i18next.t(
      enabled
        ? 'tool-hints:gripContextMenu.prompts.copyOn'
        : 'tool-hints:gripContextMenu.prompts.copyOff',
    ),
  );
  ctx.onAfterDispatch();
}

function actionReference(ctx: GripContextActionBindContext): void {
  // Reference only applies to Scale and Rotate; the controller has already
  // gated `disabled` for other modes, but we guard here for safety in case
  // the action is dispatched from a non-UI path.
  const mode = GripModeStore.getSnapshot();
  if (mode !== 'scale' && mode !== 'rotate') {
    ctx.onAfterDispatch();
    return;
  }
  GripReferenceStore.startPick(mode);
  toolHintOverrideStore.setOverride(
    i18next.t('tool-hints:gripContextMenu.prompts.pickRefStart'),
  );
  ctx.onAfterDispatch();
}

function actionSessionUndo(ctx: GripContextActionBindContext): void {
  ctx.sessionUndo();
  ctx.onAfterDispatch();
}

/**
 * Build the live `onSelect` callback for a given action meta, bound to the
 * caller-supplied context. Returns `null` only for ids the dispatcher does not
 * recognize (defensive — the resolver should already constrain the surface).
 */
export function bindContextMenuAction(
  meta: GripContextActionMeta,
  ctx: GripContextActionBindContext,
  grip?: UnifiedGripInfo,
): (() => void) | null {
  if (meta.mode) {
    const mode = meta.mode;
    return () => { actionSetMode(mode, ctx); };
  }
  switch (meta.id satisfies GripContextActionId) {
    case 'exit':
      return () => { actionExit(ctx); };
    case 'extras:basePoint':
      return () => { actionBasePoint(ctx); };
    case 'extras:copyToggle':
      return () => { actionCopyToggle(ctx); };
    case 'extras:reference':
      return () => { actionReference(ctx); };
    case 'extras:sessionUndo':
      return () => { actionSessionUndo(ctx); };
    case 'vertex-ops:deleteCorner':
      if (!grip || !ctx.onSlabVertexOp) return null;
      return () => { ctx.onSlabVertexOp!(grip, 'delete-corner'); ctx.onAfterDispatch(); };
    case 'vertex-ops:addCorner':
      if (!grip || !ctx.onSlabVertexOp) return null;
      return () => { ctx.onSlabVertexOp!(grip, 'add-corner'); ctx.onAfterDispatch(); };
    default:
      return null;
  }
}
