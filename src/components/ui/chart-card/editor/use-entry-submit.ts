'use client';

/**
 * @module chart-card/editor/use-entry-submit
 * @enterprise ADR-710 — The submit lifecycle of a chart card's entry form.
 *
 * `BudgetVarianceChart` and `DebtMaturityWall` each carried their own copy of this:
 * a `saving`/`submitting` boolean, a validity guard written inline in the handler,
 * a `try/finally`, and a reset. `jscpd` never flagged the pair because the field
 * names differ — they shared the procedure, not the tokens.
 *
 * Two properties the copies did not have:
 *
 * - **Idempotent.** A second call while one is in flight is dropped, so a double
 *   click cannot write twice. The copies re-entered `onSave` on every click.
 * - **Unmount-safe.** The flag is not cleared after the component is gone, so a slow
 *   save that resolves after the card closes does not warn or leak.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseEntrySubmitOptions<TValue> {
  /** Performs the write. Rejections propagate to `onError`, never swallowed. */
  readonly onSubmit: (value: TValue) => Promise<void>;
  /** Gate — a falsy result drops the submit silently, as a disabled control would. */
  readonly isValid?: (value: TValue) => boolean;
  /** Runs only after `onSubmit` resolves. Where a form resets itself. */
  readonly onSubmitted?: () => void;
  /** Runs when `onSubmit` rejects. Without it the rejection is re-thrown. */
  readonly onError?: (error: unknown) => void;
}

export interface UseEntrySubmitResult<TValue> {
  /** A write is in flight. Bind to the submit control's `pending`. */
  readonly submitting: boolean;
  /** Runs the write, guarded and instrumented. */
  readonly submit: (value: TValue) => Promise<void>;
}

export function useEntrySubmit<TValue>({
  onSubmit,
  isValid,
  onSubmitted,
  onError,
}: UseEntrySubmitOptions<TValue>): UseEntrySubmitResult<TValue> {
  const [submitting, setSubmitting] = useState(false);
  /** Read synchronously — `submitting` state would still be stale on a double click. */
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const submit = useCallback(
    async (value: TValue) => {
      if (inFlight.current) return;
      if (isValid && !isValid(value)) return;

      inFlight.current = true;
      setSubmitting(true);
      try {
        await onSubmit(value);
        if (mounted.current) onSubmitted?.();
      } catch (error: unknown) {
        if (!onError) throw error;
        onError(error);
      } finally {
        inFlight.current = false;
        if (mounted.current) setSubmitting(false);
      }
    },
    [isValid, onError, onSubmit, onSubmitted],
  );

  return { submitting, submit };
}
