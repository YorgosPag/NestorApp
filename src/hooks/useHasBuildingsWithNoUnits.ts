'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { useAuth } from '@/auth/hooks/useAuth';

/**
 * Returns true if at least one building has no active units.
 * Waits for Firebase auth before fetching (auth state is async on mount).
 */
export function useHasBuildingsWithNoUnits(): boolean {
  const { user } = useAuth();
  const [hasEmpty, setHasEmpty] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    let cancelled = false;

    async function check() {
      try {
        const [buildingsRes, propertiesRes] = await Promise.all([
          apiClient.get<{ buildings: { id: string }[] }>(API_ROUTES.BUILDINGS.LIST),
          apiClient.get<{ units: { buildingId?: string }[] }>(API_ROUTES.PROPERTIES.LIST),
        ]);

        if (cancelled) return;

        const buildings = buildingsRes?.buildings ?? [];
        if (buildings.length === 0) {
          setHasEmpty(false);
          return;
        }

        const units = propertiesRes?.units ?? [];
        const buildingIdsWithUnits = new Set(
          units.map((u) => u.buildingId).filter(Boolean)
        );
        setHasEmpty(buildings.some((b) => !buildingIdsWithUnits.has(String(b.id))));
      } catch {
        setHasEmpty(false);
      }
    }

    void check();
    return () => { cancelled = true; };
  }, [user?.uid]);

  return hasEmpty;
}
