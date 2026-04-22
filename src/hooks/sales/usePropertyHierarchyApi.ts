'use client';

/**
 * @fileoverview SSoT hierarchy resolver — server-side
 * @description Consumes /api/properties/[id]/hierarchy (Admin SDK, bypasses client Firestore rules).
 *
 * Why this exists:
 * - `usePropertyHierarchyValidation` uses client-side `subscribeDoc('BUILDINGS', …)` which
 *   is subject to Firestore rules (`buildings.companyId` tenant check). If a building doc
 *   has no `companyId` field persisted, or the caller's token lacks the matching claim,
 *   the client read returns null and downstream code sees `projectId = null` — false negative.
 * - The server route uses Admin SDK + `linkedCompanyId ?? companyId` fallback, so it's the
 *   single source of truth for the full Company → Project → Building → Property chain.
 *
 * Use this hook for flows that MUST succeed regardless of client rule quirks
 * (e.g. legal contract creation — ADR-230). For real-time Sales dialogs
 * (Sell/Reserve) `usePropertyHierarchyValidation` remains appropriate.
 *
 * @see ADR-197, ADR-230, ADR-284
 */

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { RealtimeService } from '@/services/realtime';
import type { PropertyHierarchyResponse } from '@/app/api/properties/[id]/hierarchy/route';

export interface PropertyHierarchyApiState {
  hierarchy: PropertyHierarchyResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePropertyHierarchyApi(
  propertyId: string | null | undefined,
  enabled = true,
): PropertyHierarchyApiState {
  const [hierarchy, setHierarchy] = useState<PropertyHierarchyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refetch = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!enabled || !propertyId) {
      setHierarchy(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiClient
      .get<PropertyHierarchyResponse>(
        API_ROUTES.PROPERTIES.HIERARCHY(encodeURIComponent(propertyId)),
      )
      .then((data) => {
        if (!cancelled) {
          setHierarchy(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [propertyId, enabled, tick]);

  useEffect(() => {
    if (!enabled) return;
    const unsubs = [
      RealtimeService.subscribe('ENTITY_LINKED', refetch),
      RealtimeService.subscribe('ENTITY_UNLINKED', refetch),
      RealtimeService.subscribe('BUILDING_PROJECT_LINKED', refetch),
      RealtimeService.subscribe('BUILDING_UPDATED', refetch),
      RealtimeService.subscribe('PROJECT_UPDATED', refetch),
      RealtimeService.subscribe('CASCADE_PROPAGATED', refetch),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [enabled, refetch]);

  return { hierarchy, loading, error, refetch };
}
