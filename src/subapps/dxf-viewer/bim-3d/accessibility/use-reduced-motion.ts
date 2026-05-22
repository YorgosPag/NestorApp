"use client";

// ============================================================================
// USE REDUCED MOTION — Hook + pure helper (ADR-366 Phase 9 / C.5.Q5)
// ============================================================================
//
// React hook: wraps window.matchMedia('(prefers-reduced-motion: reduce)') +
// settings override. Live-updates on OS preference change.
//
// Override values (stored in Bim3DPreferencesService.accessibility.reducedMotion):
//   'auto'      → follow OS preference (default)
//   'force-on'  → always reduced motion (regardless of OS)
//   'force-off' → never reduced motion (regardless of OS)
// ============================================================================

import { useEffect, useState } from 'react';

export type ReducedMotionOverride = 'auto' | 'force-on' | 'force-off';

function getMediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined') return null;
  return window.matchMedia('(prefers-reduced-motion: reduce)');
}

/**
 * React hook. Returns true when reduced motion is active (OS + override).
 * Subscribes to matchMedia change events so it reacts to live OS changes.
 */
export function useReducedMotion(override: ReducedMotionOverride = 'auto'): boolean {
  const [osPrefers, setOsPrefers] = useState<boolean>(() => {
    return getMediaQuery()?.matches ?? false;
  });

  useEffect(() => {
    if (override !== 'auto') return;
    const mq = getMediaQuery();
    if (!mq) return;
    const handler = (e: MediaQueryListEvent) => { setOsPrefers(e.matches); };
    mq.addEventListener('change', handler);
    return () => { mq.removeEventListener('change', handler); };
  }, [override]);

  if (override === 'force-on') return true;
  if (override === 'force-off') return false;
  return osPrefers;
}

/**
 * Non-hook version for non-React contexts (checks media + override at call time).
 * Does NOT subscribe to live changes — use in event handlers / one-shot checks.
 */
export function checkReducedMotion(override: ReducedMotionOverride = 'auto'): boolean {
  if (override === 'force-on') return true;
  if (override === 'force-off') return false;
  return getMediaQuery()?.matches ?? false;
}
