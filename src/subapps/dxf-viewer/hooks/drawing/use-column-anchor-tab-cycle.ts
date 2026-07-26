/**
 * ADR-363 Phase 4.5c — Tab anchor-cycle keyboard binding (column tool).
 *
 * Extracted from `useColumnTool` (N.7.1 file-size split). While the tool is in
 * `awaitingPosition`, Tab cycles the 9-state anchor ring forward (Shift+Tab
 * reverse), unless the focus is in a text input. ESC is handled centrally by
 * EscapeCommandBus (ADR-364 §4.1) — NOT here.
 *
 * @see ./useColumnTool
 */

import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { ANCHOR_CYCLE_ORDER } from '../../bim/types/column-types';
import type { ColumnToolState } from './useColumnTool';
// ADR-711 — δομικός φύλακας global accelerators (modal keyboard ownership).
import { addGlobalShortcutListener } from '../../keyboard/global-shortcut-listener';

/**
 * Bind the Tab / Shift+Tab anchor-cycle keydown listener for the duration of
 * the hosting tool's mount. `stateRef` supplies the live phase/anchor at
 * event-time (no re-subscription on every render).
 */
export function useColumnAnchorTabCycle(
  stateRef: MutableRefObject<ColumnToolState>,
  setState: Dispatch<SetStateAction<ColumnToolState>>,
): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const s = stateRef.current;
      if (s.phase !== 'awaitingPosition') return;
      // ADR-711 — ο έλεγχος «γράφει σε πεδίο;» ζει πλέον στο addGlobalShortcutListener.
      const direction: 1 | -1 = e.shiftKey ? -1 : 1;
      setState((prev) => {
        const idx = ANCHOR_CYCLE_ORDER.indexOf(prev.anchor);
        const len = ANCHOR_CYCLE_ORDER.length;
        const nextIdx = (idx + direction + len) % len;
        return { ...prev, anchor: ANCHOR_CYCLE_ORDER[nextIdx] };
      });
      e.preventDefault();
      e.stopPropagation();
    };
    // ADR-711 — δομικός φύλακας (modal + πεδίο κειμένου).
    return addGlobalShortcutListener(onKey, { capture: true });
  }, [stateRef, setState]);
}
