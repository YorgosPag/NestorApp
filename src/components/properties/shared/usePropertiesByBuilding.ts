'use client';

/**
 * usePropertiesByBuilding — Real-time property subscription scoped to a building
 *
 * Returns properties belonging to the given building, including multi-level
 * data (`levels[]`, `levelData`) needed by ADR-329 cost allocation.
 * Αφήνει έξω ό,τι έχει αποσυρθεί — κάδος ή αρχείο (`isRetired`, ADR-281 · ADR-329 §3.9).
 *
 * @module components/properties/shared/usePropertiesByBuilding
 * @see ADR-329 §3.4, §3.7 (multi-level), §3.9 (soft archive)
 */

import { useEffect, useMemo, useState } from 'react';
import { where } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { useAuth } from '@/auth/contexts/AuthContext';
import { createModuleLogger } from '@/lib/telemetry';
import { mapPropertyDoc } from '@/lib/firestore-mappers';
import { isRetired } from '@/lib/firestore/trashed-status';
import type { Property } from '@/types/property';

const logger = createModuleLogger('usePropertiesByBuilding');

export interface UsePropertiesByBuildingOptions {
  /** Skip subscription when false. */
  enabled?: boolean;
  /** Συμπεριλαμβάνει και τα αποσυρμένα (κάδος · αρχείο). Default: false. */
  includeRetired?: boolean;
}

export interface UsePropertiesByBuildingResult {
  properties: Property[];
  loading: boolean;
}

export function usePropertiesByBuilding(
  buildingId: string | null | undefined,
  options: UsePropertiesByBuildingOptions = {},
): UsePropertiesByBuildingResult {
  const { enabled = true, includeRetired = false } = options;
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
        // 🔴 **ΤΟ ΣΥΝΟΡΟ ΤΟΥ `properties`** (ADR-842 §7.6.12) — ήταν
        //    `doc as unknown as Property`, δηλαδή **διπλός** ισχυρισμός: ούτε καν ο
        //    μεταγλωττιστής δεν είχε λόγο. Ο {@link mapPropertyDoc} απαντά πλέον για
        //    κάθε πεδίο, και το είδος φτάνει **κανονικοποιημένο**.
        const items = result.documents.map((doc) => mapPropertyDoc(doc.id, doc));
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
    if (includeRetired) return raw;
    return raw.filter((p) => !isRetired(p));
  }, [raw, includeRetired]);

  return { properties, loading };
}
