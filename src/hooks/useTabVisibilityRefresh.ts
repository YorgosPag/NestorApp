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

import { useCallback, useEffect, useRef } from 'react';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useTabVisibilityRefresh');

/**
 * Listen to `visibilitychange` events and call `onVisible` when the tab
 * becomes visible again. Debounced to prevent rapid refreshes.
 *
 * Uses refs for callback stability — avoids tearing down the event listener
 * on every parent re-render.
 *
 * @param onVisible - Callback when tab becomes visible (typically forceDataRefresh)
 * @param debounceMs - Debounce delay in ms (default 1000)
 */
export function useTabVisibilityRefresh(
  onVisible: () => void,
  debounceMs = 1000
): void {
  // Keep latest callback in ref
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;

  // Stable debounced trigger
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const triggerRefresh = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      logger.info('Tab visibility refresh triggered');
      onVisibleRef.current();
    }, debounceMs);
  }, [debounceMs]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        triggerRefresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [triggerRefresh]);
}
