'use client';

/**
 * ADR-575 §enter-group — ESC steps OUT of the active group (Revit «Edit Group» / Figma).
 *
 * Registers ONE Escape-bus handler (ADR-364 SSoT) at {@link ESC_PRIORITY.GROUP_EXIT}
 * (275): while inside a group, ESC pops the innermost drill-in level and re-selects the
 * exited group, so the first ESC leaves the group (whole group selected again) and the
 * next ESC deselects it — the standard step-out ladder. Runs below GRIP_SELECTION (300,
 * clear grips first) and above ENTITY_SELECTION (250, plain deselect).
 *
 * Event-time reads: `canHandle`/`handle` read the ActiveGroupStore getters directly (not
 * a React snapshot), so the ladder reflects the live drill-in state (ADR-040 invariant).
 *
 * ADR-040: this hook registers a bus handler only — no `useSyncExternalStore`, no
 * high-frequency subscription — so it is safe to mount in the orchestrator.
 */

import { useEscapeHandler, ESC_PRIORITY } from '../escape-bus';
import { getActiveGroupId, getActiveGroupStack, exitActiveGroup } from './ActiveGroupStore';
import { SelectedEntitiesStore } from '../selection/SelectedEntitiesStore';

export function useGroupExitEscape(): void {
  useEscapeHandler({
    id: 'group/exit-active-group',
    priority: ESC_PRIORITY.GROUP_EXIT,
    canHandle: () => getActiveGroupStack().length > 0,
    handle: () => {
      const exiting = getActiveGroupId();
      exitActiveGroup();
      // Re-select the exited group: the just-active group's members re-tag with the
      // container id on the next conversion, so a member-id selection would go stale —
      // reselecting the container keeps the whole group highlighted (Figma step-out).
      if (exiting) SelectedEntitiesStore.replaceEntitySelection([exiting]);
      return true;
    },
  });
}
