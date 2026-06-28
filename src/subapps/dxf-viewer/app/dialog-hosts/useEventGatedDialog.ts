'use client';

/**
 * ADR-532 Stage 3 — mount-gate for an always-listed dialog host that opens via a
 * single EventBus signal.
 *
 * THE PROBLEM IT SOLVES: every dialog host in `DxfViewerDialogs` is listed once
 * and stays in the tree for its whole life so it can listen for its "open" event.
 * Before this hook each host kept its heavy body (i18n labels, `useMemo` model
 * builds, Radix `<Dialog>` subtree) mounted while CLOSED — so a click-selection
 * commit re-rendered every closed dialog for nothing (the ~117 dialog fibers in
 * the selection-cascade profile; see HANDOFF_2026-06-28_selection-click-rerender-cascade).
 *
 * THE FIX: the host keeps ONLY this hook (a `useState` + one `EventBus.on`) and
 * renders its body strictly when `open`. Closed → the host returns `null` → zero
 * subtree in the per-selection commit. Mirrors the gate-at-mount pattern already
 * applied inline to CreditsDialog / import dialogs in `DxfViewerDialogs`, promoted
 * here to a typed SSoT so every host gates the same way.
 *
 * @example
 * const { open, payload, close } = useEventGatedDialog(
 *   'bim:column-detail-requested',
 *   ({ columnId, levelId }) => resolveColumn(levelManager, levelId, columnId) !== null,
 * );
 * if (!open || !payload) return null;
 * return <ColumnDetailBody {...payload} onClose={close} />;
 *
 * @see docs/centralized-systems/reference/adrs/ADR-532-selection-set-ssot.md (Stage 3)
 */

import * as React from 'react';

import { EventBus, type DrawingEventType, type DrawingEventPayload } from '../../systems/events/EventBus';

export interface EventGatedDialog<T extends DrawingEventType> {
  /** True between the open event and `close()` — render the heavy body only then. */
  readonly open: boolean;
  /** The payload that opened the dialog (entity ids, scope, …); `null` while closed. */
  readonly payload: DrawingEventPayload<T> | null;
  /** Close + drop the payload. Wire to the dialog's `onOpenChange(false)`. */
  readonly close: () => void;
}

/**
 * Subscribe (mounted-once) to one EventBus signal and expose `{ open, payload, close }`.
 *
 * `accept` runs synchronously at emit time; return `false` to ignore the event so
 * the dialog never opens (e.g. the payload's entity is missing from the scene).
 * It is read through a ref, so passing a fresh closure every render does NOT
 * re-subscribe — the listener stays attached for the host's whole life and always
 * sees the latest props.
 */
export function useEventGatedDialog<T extends DrawingEventType>(
  eventType: T,
  accept?: (payload: DrawingEventPayload<T>) => boolean,
): EventGatedDialog<T> {
  const [state, setState] = React.useState<{ open: boolean; payload: DrawingEventPayload<T> | null }>({
    open: false,
    payload: null,
  });

  // Latest `accept` without re-subscribing the listener (deps = [eventType] only).
  const acceptRef = React.useRef(accept);
  acceptRef.current = accept;

  React.useEffect(() => {
    return EventBus.on(eventType, (payload) => {
      if (acceptRef.current && !acceptRef.current(payload)) return;
      setState({ open: true, payload });
    });
  }, [eventType]);

  const close = React.useCallback(() => {
    setState((prev) => (prev.open ? { open: false, payload: null } : prev));
  }, []);

  return { open: state.open, payload: state.payload, close };
}
