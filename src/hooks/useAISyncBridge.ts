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

import { useEffect, useRef } from 'react';
import type { DocumentData } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { SYSTEM_DOCS } from '@/config/firestore-collections';
import { SYNC_SOURCE_AI_AGENT, type SyncEntityType } from '@/services/realtime';
import { useAuth } from '@/hooks/useAuth';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useAISyncBridge');

/**
 * Subscribe to the centralized AI sync signal document.
 * Filters by `entityType` — only triggers refresh for matching entity mutations.
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

  const debouncedSignal = useDebouncedCallback(() => {
    onSignal();
  }, debounceMs);

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
          debouncedSignal();
        }
      },
      (err) => logger.warn('Signal subscription error', { entityType, error: err.message })
    );

    return () => {
      unsub();
      signalInitialized.current = false;
    };
  }, [user, authLoading, entityType, debouncedSignal]);
}
