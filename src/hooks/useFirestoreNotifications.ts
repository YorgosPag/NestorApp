// hooks/useFirestoreNotifications.ts
// ✅ Real-time Firestore notifications με onSnapshot

import { useEffect } from 'react';
import { subscribeToNotifications } from '@/services/notificationService';
import { useNotificationCenter } from '@/stores/notificationCenter';
import type { Notification } from '@/types/notification';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useFirestoreNotifications');

export interface FirestoreNotificationOptions {
  userId: string;
  enabled?: boolean; // Για να μπορούμε να το disable
}

/**
 * Real-time Firestore notifications hook
 * Χρησιμοποιεί onSnapshot για instant updates χωρίς polling
 */
export function useFirestoreNotifications(opts: FirestoreNotificationOptions) {
  const { ingest, setStatus, setError } = useNotificationCenter();

  useEffect(() => {
    // Skip if disabled or SSR
    if (typeof window === 'undefined' || opts.enabled === false) return;


    setStatus('loading');

    const unsubscribe = subscribeToNotifications(
      opts.userId,
      (notifications: Notification[]) => {
        ingest(notifications);
        setStatus('ready');
      },
      (error: Error) => {
        logger.error('Firestore listener error', { error });
        setError(error.message);
        setStatus('error');
      }
    );

    return () => {
      unsubscribe();
    };
    // ✅ FIX: Only re-run when userId or enabled changes, not when store functions change
  }, [opts.userId, opts.enabled, ingest, setStatus, setError]);
}
