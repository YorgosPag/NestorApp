'use client';

/**
 * 🚨 GLOBAL ERROR TRACKER SETUP - CLIENT COMPONENT
 *
 * Makes errorTracker globally available for console testing
 * and initializes the global error handling system
 */

import { useEffect } from 'react';
import type { ErrorTracker } from '@/services/ErrorTracker';

// 🏢 ENTERPRISE: Extend Window interface for type-safe global access
declare global {
  interface Window {
    errorTracker?: ErrorTracker;
  }
}

export function GlobalErrorSetup() {
  useEffect(() => {
    // Make errorTracker globally available for console testing
    import('@/services/ErrorTracker').then(({ errorTracker }) => {
      window.errorTracker = errorTracker;
      // Debug disabled: ErrorTracker initialization message
    });
  }, []);

  return null;
}