/**
 * =============================================================================
 * 🏢 ENTERPRISE: Property Media Counts Hook
 * =============================================================================
 *
 * Real-time Firestore subscription για photo + floorplan counts associated
 * with a property. Used από τον completion meter (ADR-287 Batch 28) για
 * weighted media score.
 *
 * **Query strategy**: Riusa canonical `firestoreQueryService.subscribe<FILES>`
 * pattern — identical contract ως `useFloorplanFiles`. CompanyId auto-injected
 * via service per CHECK 3.10 Firestore rules.
 *
 * **Videos**: Skip V1 — VideosTabContent είναι stub senza data source reale.
 * Hook signature extension-ready: όταν wired, αρκεί extra query.
 *
 * **Multi-level**: Floorplans può avere `levelFloorId` (ADR-236 Phase 3). Το
 * hook επιστρέφει aggregate count — ο completion meter calcola partial score
 * βάσει `count / levelCount`.
 *
 * @module hooks/properties/usePropertyMediaCounts
 * @enterprise ADR-287 Batch 28 — Completion Meter
 */

'use client';

import { useEffect, useState } from 'react';
import { where } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyId } from '@/hooks/useCompanyId';
import { firestoreQueryService, type QueryResult } from '@/services/firestore';
import {
  FILE_CATEGORIES,
  FILE_DOMAINS,
  FILE_LIFECYCLE_STATES,
} from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('usePropertyMediaCounts');

// =============================================================================
// TYPES
// =============================================================================

export interface UsePropertyMediaCountsParams {
  /** Property ID. Pass `null` to skip (e.g. during inline creation). */
  readonly propertyId: string | null | undefined;
}

export interface UsePropertyMediaCountsReturn {
  /** Number of photos linked to this property (sales-domain photos category). */
  readonly photos: number;
  /** Number of floorplan files linked to this property (construction-domain). */
  readonly floorplan: number;
  /** Loading state — true until both subscriptions deliver initial snapshot. */
  readonly isLoading: boolean;
  /** Error message from either subscription, `null` otherwise. */
  readonly error: string | null;
}

// =============================================================================
// HOOK
// =============================================================================

export function usePropertyMediaCounts(
  params: UsePropertyMediaCountsParams,
): UsePropertyMediaCountsReturn {
  const { propertyId } = params;
  const { user, loading: authLoading } = useAuth();
  const companyResult = useCompanyId();
  const companyId = companyResult?.companyId ?? null;

  const [photos, setPhotos] = useState(0);
  const [floorplan, setFloorplan] = useState(0);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [floorplanLoading, setFloorplanLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Photos subscription ──────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user || !companyId || !propertyId || propertyId === '__new__') {
      setPhotos(0);
      setPhotosLoading(false);
      return;
    }

    setPhotosLoading(true);
    const unsubscribe = firestoreQueryService.subscribe<DocumentData>(
      'FILES',
      (result: QueryResult<DocumentData>) => {
        setPhotos(result.documents.length);
        setPhotosLoading(false);
      },
      (err: unknown) => {
        const message = getErrorMessage(err, 'Failed to load property photos');
        logger.error('Photos subscription error', { propertyId, error: message });
        setError(message);
        setPhotosLoading(false);
      },
      {
        constraints: [
          where('entityType', '==', 'property'),
          where('entityId', '==', propertyId),
          where('domain', '==', FILE_DOMAINS.SALES),
          where('category', '==', FILE_CATEGORIES.PHOTOS),
          where('lifecycleState', '==', FILE_LIFECYCLE_STATES.ACTIVE),
        ],
      },
    );

    return () => {
      unsubscribe();
    };
  }, [authLoading, user, companyId, propertyId]);

  // ── Floorplan subscription ───────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user || !companyId || !propertyId || propertyId === '__new__') {
      setFloorplan(0);
      setFloorplanLoading(false);
      return;
    }

    setFloorplanLoading(true);
    const unsubscribe = firestoreQueryService.subscribe<DocumentData>(
      'FILES',
      (result: QueryResult<DocumentData>) => {
        setFloorplan(result.documents.length);
        setFloorplanLoading(false);
      },
      (err: unknown) => {
        const message = getErrorMessage(err, 'Failed to load property floorplans');
        logger.error('Floorplan subscription error', { propertyId, error: message });
        setError(message);
        setFloorplanLoading(false);
      },
      {
        constraints: [
          where('entityType', '==', 'property'),
          where('entityId', '==', propertyId),
          where('domain', '==', FILE_DOMAINS.CONSTRUCTION),
          where('category', '==', FILE_CATEGORIES.FLOORPLANS),
          where('lifecycleState', '==', FILE_LIFECYCLE_STATES.ACTIVE),
        ],
      },
    );

    return () => {
      unsubscribe();
    };
  }, [authLoading, user, companyId, propertyId]);

  return {
    photos,
    floorplan,
    isLoading: photosLoading || floorplanLoading,
    error,
  };
}
