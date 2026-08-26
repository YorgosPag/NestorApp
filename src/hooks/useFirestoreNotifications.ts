// hooks/useFirestoreNotifications.ts
// ✅ Real-time Firestore notifications με onSnapshot

import { useEffect } from 'react';
import { isMissingTenantError } from '@/services/firestore/auth-context';
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
    // Skip if disabled, SSR, or no authenticated user
    if (typeof window === 'undefined' || opts.enabled === false || !opts.userId) return;

    setStatus('loading');

    const unsubscribe = subscribeToNotifications(
      opts.userId,
      (notifications: Notification[]) => {
        ingest(notifications);
        setStatus('ready');
      },
      (error: Error) => {
        // 🔴 **«ΔΕΝ ΕΧΕΙΣ ΕΤΑΙΡΕΙΑ» ΔΕΝ ΕΙΝΑΙ ΒΛΑΒΗ** (ADR-807 · ADR-813 Φάση Β).
        //    Ο αυτόνομος επαγγελματίας **νόμιμα** δεν ανήκει σε οργανισμό· τα
        //    ειδοποιητήρια εταιρείας απλώς δεν τον αφορούν. Η καταγραφή του ως
        //    κόκκινο `[ERROR]` έκανε **κανονική κατάσταση** να μοιάζει με
        //    αποτυχία σε **κάθε φόρτωση σελίδας**.
        //
        // ⚠️ Ο έλεγχος γίνεται με το **brand** (`isMissingTenantError`), ποτέ με
        //    σύγκριση κειμένου: το μήνυμα αλλάζει, η ταυτότητα όχι — και το
        //    brand επιβιώνει όταν το module φορτωθεί σε δεύτερο γράφο (Server ≠
        //    Client), όπου το `instanceof` απαντά ψευδώς `false`.
        if (isMissingTenantError(error)) {
          setStatus('ready');
          return;
        }
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
