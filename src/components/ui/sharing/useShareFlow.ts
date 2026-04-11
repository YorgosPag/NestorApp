/**
 * =============================================================================
 * 🏢 ENTERPRISE: useShareFlow — Generic Share State Machine
 * =============================================================================
 *
 * Owns the idle → configuring → submitting → success | error transitions for
 * any sharing feature. Guards against double-submit and unmounted-component
 * state updates. Services are injected via the `submit` option — the hook
 * itself is domain-agnostic.
 *
 * @module components/ui/sharing/useShareFlow
 * @see ADR-147 Unified Share Surface
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import type {
  ShareDraftUpdater,
  ShareFlowHandle,
  ShareFlowOptions,
  ShareFlowState,
} from '@/types/sharing';

const logger = createModuleLogger('SHARE_FLOW');

function initialState<TResult>(): ShareFlowState<TResult> {
  return { status: 'idle', error: null, result: null };
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown share error';
}

export function useShareFlow<TDraft, TResult>(
  options: ShareFlowOptions<TDraft, TResult>,
): ShareFlowHandle<TDraft, TResult> {
  const { initialDraft, submit: submitFn, onSuccess, onError } = options;

  const [state, setState] = useState<ShareFlowState<TResult>>(() =>
    initialState<TResult>(),
  );
  const [draft, setDraftState] = useState<TDraft>(initialDraft);

  const isMountedRef = useRef(true);
  const statusRef = useRef<ShareFlowState<TResult>['status']>('idle');
  statusRef.current = state.status;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const setDraft: ShareDraftUpdater<TDraft> = useCallback((next) => {
    setDraftState((prev) =>
      typeof next === 'function'
        ? (next as (prev: TDraft) => TDraft)(prev)
        : next,
    );
    setState((prev) =>
      prev.status === 'idle'
        ? { ...prev, status: 'configuring' }
        : prev,
    );
  }, []);

  const reset = useCallback(() => {
    setDraftState(initialDraft);
    setState(initialState<TResult>());
  }, [initialDraft]);

  const submit = useCallback(async (): Promise<void> => {
    if (statusRef.current === 'submitting') {
      logger.warn('Double-submit guard triggered');
      return;
    }
    setState({ status: 'submitting', error: null, result: null });

    try {
      const result = await submitFn(draft);
      if (!isMountedRef.current) {
        logger.debug('Share flow unmounted before success — discarding result');
        return;
      }
      setState({ status: 'success', error: null, result });
      onSuccess?.(result);
    } catch (error) {
      if (!isMountedRef.current) {
        logger.debug('Share flow unmounted before error — discarding');
        return;
      }
      const message = extractErrorMessage(error);
      logger.error('Share flow submit failed', { error: message });
      setState({ status: 'error', error: message, result: null });
      onError?.(error);
    }
  }, [draft, submitFn, onSuccess, onError]);

  return { state, draft, setDraft, submit, reset };
}
