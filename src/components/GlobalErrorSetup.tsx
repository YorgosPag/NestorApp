'use client';

/**
 * 🚨 GLOBAL ERROR TRACKER SETUP - CLIENT COMPONENT
 *
 * Makes errorTracker globally available for console testing
 * and initializes the global error handling system
 */

import { useEffect } from 'react';

export function GlobalErrorSetup() {
  useEffect(() => {
    // Make errorTracker globally available for console testing
    import('@/services/ErrorTracker').then(({ errorTracker }) => {
      (window as any).errorTracker = errorTracker;
      console.log('🚨 ErrorTracker is now globally available! Try: errorTracker.captureError(new Error("test"), "error", "system")');
    });
  }, []);

  return null;
}