'use client';

/**
 * 🏢 ENTERPRISE: Tab Visibility Refresh Hook
 *
 * Triggers a debounced callback when the browser tab becomes visible.
 * Covers the scenario: user sends Telegram command → switches back to browser.
 *
 * Usage:
 * ```tsx
 * useTabVisibilityRefresh(forceDataRefresh);
 * ```
 */

import { useEffect } from 'react';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useTabVisibilityRefresh');

/**
 * Listen to `visibilitychange` events and call `onVisible` when the tab
 * becomes visible again. Debounced to prevent rapid refreshes.
 *
 * @param onVisible - Callback when tab becomes visible (typically forceDataRefresh)
 * @param debounceMs - Debounce delay in ms (default 1000)
 */
export function useTabVisibilityRefresh(
  onVisible: () => void,
  debounceMs = 1000
): void {
  const debouncedRefresh = useDebouncedCallback(() => {
    logger.info('Tab visibility refresh triggered');
    onVisible();
  }, debounceMs);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        debouncedRefresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [debouncedRefresh]);
}
