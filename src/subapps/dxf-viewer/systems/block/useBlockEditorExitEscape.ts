'use client';

/**
 * ADR-641 §3 — ESC closes the active Block Editor (BEDIT), the BLOCK twin of
 * {@link useGroupExitEscape} (ADR-575 §enter-group).
 *
 * Registers ONE Escape-bus handler (ADR-364 SSoT) at {@link ESC_PRIORITY.BLOCK_EDITOR_EXIT} (274):
 * while inside a Block Editor, ESC leaves the editor and re-selects the exited block (whole block
 * highlighted again), so the next ESC deselects it — the standard step-out ladder. Runs below
 * GRIP_SELECTION (300, clear member grips first) and above ENTITY_SELECTION (250, plain deselect).
 *
 * Event-time reads: `canHandle`/`handle` read the ActiveBlockEditStore getters directly (not a React
 * snapshot), so the ladder reflects the live editor state (ADR-040 dual-access invariant).
 *
 * ADR-040: this hook registers a bus handler only — no `useSyncExternalStore`, no high-frequency
 * subscription — so it is safe to mount in the orchestrator (alongside `useGroupExitEscape`).
 */

import { useEscapeHandler, ESC_PRIORITY } from '../escape-bus';
import { isBlockEditActive } from './ActiveBlockEditStore';
import { exitBlockEditAndReselect } from './exit-block-editor';

export function useBlockEditorExitEscape(): void {
  useEscapeHandler({
    id: 'block/exit-block-editor',
    priority: ESC_PRIORITY.BLOCK_EDITOR_EXIT,
    canHandle: () => isBlockEditActive(),
    handle: () => {
      exitBlockEditAndReselect();
      return true;
    },
  });
}
