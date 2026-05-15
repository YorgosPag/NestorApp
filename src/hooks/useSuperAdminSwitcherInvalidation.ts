'use client';

/**
 * useSuperAdminSwitcherInvalidation — Client SSOT (ADR-356)
 *
 * Single hook every REST-backed data consumer uses to re-fetch when the super
 * admin company switcher changes. Replaces the duplicated `useEffect` +
 * `onSuperAdminActiveCompanyChange` boilerplate that previously lived in
 * `NavigationContext`, `useFirestoreProjects`, and would otherwise spread to
 * every new consumer.
 *
 * Firestore-listener consumers do NOT need this hook — `firestoreQueryService`
 * already rebuilds subscriptions automatically (ADR-354 entry point #3).
 * This hook exists for REST/HTTP fetch paths where there is no live listener.
 */

import { useEffect } from 'react';
import { onSuperAdminActiveCompanyChange } from '@/services/firestore/super-admin-active-company';

interface Options {
  /** When false, no subscription is registered. Default: true. */
  enabled?: boolean;
}

/**
 * Subscribe to super-admin switcher changes. The `onInvalidate` callback
 * fires on every selection change. It should:
 *   1. clear any module-level / ref cache the consumer owns,
 *   2. arm a "bust server cache on next request" flag (e.g. append `?t=<ts>`),
 *   3. trigger a refetch.
 *
 * Pass a stable identity for `onInvalidate` (e.g. wrap with `useCallback`) to
 * avoid resubscribing on every render.
 */
export function useSuperAdminSwitcherInvalidation(
  onInvalidate: () => void,
  options: Options = {},
): void {
  const { enabled = true } = options;
  useEffect(() => {
    if (!enabled) return;
    return onSuperAdminActiveCompanyChange(onInvalidate);
  }, [enabled, onInvalidate]);
}
