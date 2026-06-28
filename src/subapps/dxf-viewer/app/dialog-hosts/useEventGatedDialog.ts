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
 * @example // simple: open immediately on the event, capture its payload
 * const { open, payload, close } = useEventGatedDialog(
 *   'bim:column-detail-requested',
 *   ({ columnId, levelId }) => resolveColumn(levelManager, levelId, columnId) !== null,
 * );
 * if (!open || !payload) return null;
 * return <ColumnDetailBody {...payload} onClose={close} />;
 *
 * @example // load-then-open: await async data BEFORE the dialog mounts
 * const { open, data, close } = useEventGatedDialog('bim:opening-renumber-requested', {
 *   beforeOpen: async () => {
 *     if (!companyId) return null;            // null → abort, dialog never opens
 *     return { rows: await loadRows(companyId) };
 *   },
 * });
 * if (!open || !data) return null;
 * return <RenumberContent rows={data.rows} onClose={close} />;
 *
 * @see docs/centralized-systems/reference/adrs/ADR-532-selection-set-ssot.md (Stage 3)
 */

import * as React from 'react';

import { EventBus, type DrawingEventType, type DrawingEventPayload } from '../../systems/events/EventBus';

export interface EventGatedDialogOptions<T extends DrawingEventType, D> {
  /**
   * Runs synchronously at emit time; return `false` to ignore the event so the
   * dialog never opens (e.g. the payload's entity is missing from the scene).
   */
  readonly accept?: (payload: DrawingEventPayload<T>) => boolean;
  /**
   * Runs at emit time (after `accept`) to produce the data the body needs BEFORE
   * it mounts (e.g. a Firestore load) — the dialog opens only once this resolves.
   * Return `null` to abort the open. May be sync or async; a rejected promise
   * also aborts. A newer event or `close()` while it is in-flight discards the
   * stale result.
   */
  readonly beforeOpen?: (payload: DrawingEventPayload<T>) => Promise<D | null> | D | null;
}

export interface EventGatedDialog<T extends DrawingEventType, D = undefined> {
  /** True between the open event and `close()` — render the heavy body only then. */
  readonly open: boolean;
  /** The payload that opened the dialog (entity ids, scope, …); `null` while closed. */
  readonly payload: DrawingEventPayload<T> | null;
  /** The `beforeOpen` result (load-then-open hosts); `null` when no `beforeOpen`. */
  readonly data: D | null;
  /** Close + drop the payload/data. Wire to the dialog's `onOpenChange(false)`. */
  readonly close: () => void;
}

type AcceptOrOptions<T extends DrawingEventType, D> =
  | ((payload: DrawingEventPayload<T>) => boolean)
  | EventGatedDialogOptions<T, D>;

interface GateState<T extends DrawingEventType, D> {
  open: boolean;
  payload: DrawingEventPayload<T> | null;
  data: D | null;
}

const CLOSED: GateState<DrawingEventType, unknown> = { open: false, payload: null, data: null };

/**
 * Subscribe (mounted-once) to one EventBus signal and expose
 * `{ open, payload, data, close }`.
 *
 * The second argument is either an `accept` predicate (shorthand) or a full
 * {@link EventGatedDialogOptions} object. Both `accept` and `beforeOpen` are read
 * through a ref, so passing fresh closures every render does NOT re-subscribe —
 * the listener stays attached for the host's whole life and always sees the
 * latest props.
 */
export function useEventGatedDialog<T extends DrawingEventType, D = undefined>(
  eventType: T,
  acceptOrOptions?: AcceptOrOptions<T, D>,
): EventGatedDialog<T, D> {
  const [state, setState] = React.useState<GateState<T, D>>(CLOSED as GateState<T, D>);

  // Latest options without re-subscribing the listener (deps = [eventType] only).
  const optionsRef = React.useRef<EventGatedDialogOptions<T, D>>({});
  optionsRef.current = typeof acceptOrOptions === 'function'
    ? { accept: acceptOrOptions }
    : (acceptOrOptions ?? {});

  // Monotonic token: a newer event, `close()`, or unmount invalidates any
  // in-flight `beforeOpen` so a late resolution can't open a stale dialog.
  const tokenRef = React.useRef(0);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = EventBus.on(eventType, (payload) => {
      const { accept, beforeOpen } = optionsRef.current;
      if (accept && !accept(payload)) return;

      tokenRef.current += 1;
      const token = tokenRef.current;
      const apply = (data: D | null): void => {
        if (!mountedRef.current || tokenRef.current !== token) return; // stale
        if (data === null && beforeOpen) return; // beforeOpen aborted the open
        setState({ open: true, payload, data });
      };

      if (!beforeOpen) {
        apply(null);
        return;
      }
      const result = beforeOpen(payload);
      if (result instanceof Promise) {
        result.then(apply).catch(() => { /* rejected → no open */ });
      } else {
        apply(result);
      }
    });
    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [eventType]);

  const close = React.useCallback(() => {
    tokenRef.current += 1; // invalidate any in-flight beforeOpen
    setState((prev) => (prev.open ? (CLOSED as GateState<T, D>) : prev));
  }, []);

  return { open: state.open, payload: state.payload, data: state.data, close };
}
