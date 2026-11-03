// hooks/useFirestoreNotifications.ts
// ✅ Real-time Firestore notifications — δανεισμός της ΜΙΑΣ ροής (`stores/notification-feed.ts`).
//
// 🔑 Όσα σημεία κι αν το καλούν (κουδούνι, σελίδα ειδοποιήσεων), ανοίγει **ένας** ακροατής ανά χρήστη.
//    Ήταν απευθείας `subscribeToNotifications` εδώ **και** δεύτερος στη σελίδα — δύο αναγνώσεις, δύο μνήμες
//    (ADR-927). Η λογική σφάλματος («δεν έχεις εταιρεία» ≠ βλάβη) μετακόμισε μαζί με τη ροή.

import { useEffect } from 'react';
import { acquireNotificationFeed } from '@/stores/notification-feed';

export interface FirestoreNotificationOptions {
  userId: string;
  enabled?: boolean; // Για να μπορούμε να το disable
}

/**
 * Κρατά ανοιχτή τη ροή ειδοποιήσεων του `userId` όσο είναι mounted ο καλών.
 * Τα δεδομένα διαβάζονται από το `useNotificationCenter`.
 */
export function useFirestoreNotifications(opts: FirestoreNotificationOptions): void {
  const { userId, enabled } = opts;

  useEffect(() => {
    // Skip if disabled, SSR, or no authenticated user
    if (typeof window === 'undefined' || enabled === false || !userId) return;
    return acquireNotificationFeed(userId);
  }, [userId, enabled]);
}
