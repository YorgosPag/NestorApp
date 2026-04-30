'use client';

/**
 * usePropertiesByBuilding — Real-time property subscription scoped to a building
 *
 * Returns properties belonging to the given building, including multi-level
 * data (`levels[]`, `levelData`) needed by ADR-329 cost allocation.
 * Filters out soft-archived properties (`archivedAt != null`) by default.
 *
 * @module components/properties/shared/usePropertiesByBuilding
 * @see ADR-329 §3.4, §3.7 (multi-level), §3.9 (soft archive)
 */

import { useEffect, useMemo, useState } from 'react';
import { where } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { useAuth } from '@/auth/contexts/AuthContext';
import { createModuleLogger } from '@/lib/telemetry';
import type { Property } from '@/types/property';

const logger = createModuleLogger('usePropertiesByBuilding');

export interface UsePropertiesByBuildingOptions {
  /** Skip subscription when false. */
  enabled?: boolean;
  /** Include soft-archived (archivedAt != null) properties. Default: false. */
  includeArchived?: boolean;
}

export interface UsePropertiesByBuildingResult {
  properties: Property[];
  loading: boolean;
}

export function usePropertiesByBuilding(
  buildingId: string | null | undefined,
  options: UsePropertiesByBuildingOptions = {},
): UsePropertiesByBuildingResult {
  const { enabled = true, includeArchived = false } = options;
  const { user } = useAuth();
  const [raw, setRaw] = useState<Property[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!enabled || !buildingId || !user) {
      setRaw([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = firestoreQueryService.subscribe<Record<string, unknown> & { id: string }>(
      'PROPERTIES',
      (result) => {
        const items = result.documents.map((doc) => doc as unknown as Property);
        setRaw(items);
        setLoading(false);
      },
      (err) => {
        logger.error('Failed to subscribe to properties', { error: err.message, buildingId });
        setRaw([]);
        setLoading(false);
      },
      {
        constraints: [where('buildingId', '==', buildingId)],
      },
    );
    return () => unsubscribe();
  }, [enabled, buildingId, user]);

  const properties = useMemo(() => {
    if (includeArchived) return raw;
    return raw.filter((p) => p.archivedAt == null);
  }, [raw, includeArchived]);

  return { properties, loading };
}
