'use client';

/**
 * 🚨 GLOBAL ERROR TRACKER SETUP - CLIENT COMPONENT
 *
 * Makes errorTracker globally available for console testing
 * and initializes the global error handling system
 */

import { useEffect } from 'react';

// 🏢 ENTERPRISE: Extend Window interface for type-safe global access
// Note: errorTracker is a proxy object with methods, not the full ErrorTracker class instance
declare global {
  interface Window {
    errorTracker?: typeof import('@/services/ErrorTracker').errorTracker; // 🏢 ENTERPRISE: Use exact proxy type
  }
}

export function GlobalErrorSetup() {
  useEffect(() => {
    // Make errorTracker globally available for console testing
    import('@/services/ErrorTracker').then(({ errorTracker }) => {
      window.errorTracker = errorTracker;
      // Debug disabled: ErrorTracker initialization message
    });

    // ADR-367 — Firestore SDK internal-assertion recovery net.
    // Detects "FIRESTORE INTERNAL ASSERTION FAILED (ID: …)" errors and runs
    // terminate → reload (1× per session).
    import('@/lib/firestore-recovery').then(({ installFirestoreRecoveryListener }) => {
      installFirestoreRecoveryListener();
    });

    // ADR-367 §2.5 — σβήνει την IndexedDB της παλιάς persistentLocalCache (1× ανά browser).
    import('@/lib/firestore-legacy-cache').then(({ purgeLegacyFirestoreCache }) => {
      purgeLegacyFirestoreCache();
    });

    // ADR-367 §2.6 — ανεπιβεβαίωτες εγγραφές Firestore → `unsaved-work-registry`
    // (προειδοποίηση στο κλείσιμο + καμία αυτόματη ανανέωση από κάτω τους).
    import('@/lib/firestore-pending-writes').then(({ installFirestorePendingWritesWatcher }) => {
      installFirestorePendingWritesWatcher();
    });
  }, []);

  return null;
}