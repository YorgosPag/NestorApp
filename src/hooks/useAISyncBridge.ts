'use client';

/**
 * 🏢 ENTERPRISE: Generic AI Sync Bridge Hook
 *
 * Subscribes to `config/ui_sync_signal` via Firestore onSnapshot.
 * When an AI agent writes a mutation signal matching `entityType`,
 * calls `onSignal()` (debounced) to trigger a UI refresh.
 *
 * Usage:
 * ```tsx
 * useAISyncBridge('contacts', forceDataRefresh);
 * useAISyncBridge('tasks', forceDataRefresh);
 * ```
 *
 * @see emitEntitySyncSignal (server-side emitter)
 */

import { useCallback, useEffect, useRef } from 'react';
import type { DocumentData } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { SYSTEM_DOCS } from '@/config/firestore-collections';
import { SYNC_SOURCE_AI_AGENT, type SyncEntityType } from '@/services/realtime';
import { useAuth } from '@/hooks/useAuth';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useAISyncBridge');

/**
 * Subscribe to the centralized AI sync signal document.
 * Filters by `entityType` — only triggers refresh for matching entity mutations.
 *
 * Uses refs for callback + debounce to keep the Firestore subscription STABLE
 * across re-renders. Without this, `subscribeDoc`'s async `requireAuthContext()`
 * gets cancelled before it can complete (the subscription never starts).
 *
 * @param entityType - Which entity type to listen for (e.g. 'contacts', 'tasks')
 * @param onSignal - Callback when a matching signal is received (typically forceDataRefresh)
 * @param debounceMs - Debounce delay in ms (default 1000)
 */
export function useAISyncBridge(
  entityType: SyncEntityType,
  onSignal: () => void,
  debounceMs = 1000
): void {
  const { user, loading: authLoading } = useAuth();
  const signalInitialized = useRef(false);

  // Keep latest callback in ref — avoids unstable closure in effect deps
  const onSignalRef = useRef(onSignal);
  onSignalRef.current = onSignal;

  // Stable debounced trigger — never changes identity, so effect stays stable
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const triggerRefresh = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      onSignalRef.current();
    }, debounceMs);
  }, [debounceMs]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;

    const unsub = firestoreQueryService.subscribeDoc<DocumentData>(
      'CONFIG',
      SYSTEM_DOCS.UI_SYNC_SIGNAL,
      (signalDoc) => {
        // Skip the initial snapshot (first load — not a real signal)
        if (!signalInitialized.current) {
          signalInitialized.current = true;
          return;
        }
        if (
          signalDoc?.source === SYNC_SOURCE_AI_AGENT &&
          signalDoc?.entityType === entityType
        ) {
          logger.info('AI sync signal received', {
            entityType,
            action: signalDoc.action,
            entityId: signalDoc.entityId,
          });
          triggerRefresh();
        }
      },
      (err) => logger.warn('Signal subscription error', { entityType, error: err.message })
    );

    return () => {
      unsub();
      signalInitialized.current = false;
    };
    // triggerRefresh is stable (depends only on debounceMs which is constant)
    // entityType is a string literal — stable
  }, [user, authLoading, entityType, triggerRefresh]);
}
