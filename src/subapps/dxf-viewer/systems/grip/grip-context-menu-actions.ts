/**
 * GRIP CONTEXT MENU ACTIONS — ADR-357 Phase 11 / G10.A
 *
 * Action dispatcher that turns a resolved {@link GripContextActionId} into a
 * bound `onSelect` callback. No React, no DOM. Receives a context with the
 * `GripModeStore` setter and the `handleEscape` callback exposed by
 * `useUnifiedGripInteraction` so a right-click `Exit` cancels the active drag
 * cleanly (same code path the unified hook used when right-click was an alias
 * of escape).
 *
 * @see grip-context-menu-resolver — pure resolver
 * @see GripContextMenuStore       — UI state container
 * @see GripModeStore              — mode SSoT consumed by `commitDxfGripDragModeAware`
 */

import i18next from 'i18next';
import { GripModeStore } from './GripModeStore';
import { gripModeMeta, type GripMode } from './grip-mode-cycle';
import { toolHintOverrideStore } from '../../hooks/toolHintOverrideStore';
import type { GripContextActionId, GripContextActionMeta } from './grip-context-menu-resolver';

export interface GripContextActionBindContext {
  /** Cancel the active grip drag (mirror of `useUnifiedGripInteraction.handleEscape`). */
  readonly handleEscape: () => void;
  /** Close the context menu after dispatch — usually `GripContextMenuStore.hide`. */
  readonly onAfterDispatch: () => void;
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

/**
 * Build the live `onSelect` callback for a given action meta, bound to the
 * caller-supplied context. Returns `null` only for ids the dispatcher does not
 * recognize (defensive — the resolver should already constrain the surface).
 */
export function bindContextMenuAction(
  meta: GripContextActionMeta,
  ctx: GripContextActionBindContext,
): (() => void) | null {
  if (meta.mode) {
    const mode = meta.mode;
    return () => { actionSetMode(mode, ctx); };
  }
  switch (meta.id satisfies GripContextActionId) {
    case 'exit':
      return () => { actionExit(ctx); };
    default:
      return null;
  }
}
