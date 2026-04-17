'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: usePhotosTabFetch — Live Firestore subscription for entity photos
 * =============================================================================
 *
 * ADR-293 Phase 5 Batch 29 — Property Photo Pipeline Fix.
 *
 * Subscribes to the canonical `files` collection for a specific entity and
 * returns the ready, non-deleted Photo records. Mirrors the query contract
 * of usePropertyMediaCounts (ADR-287 Batch 28) so the read side of the photo
 * tab matches the write side of uploadEntityPhotoCanonical.
 *
 * Replaces the silent gap where PhotosTabBase never fetched existing photos
 * from Firestore — previously every mount started with an empty array and
 * only session-local uploads were visible.
 *
 * @enterprise ADR-287 Batch 28 + ADR-293 Phase 5 Batch 29
 */

import { useEffect, useState } from 'react';
import { where } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyId } from '@/hooks/useCompanyId';
import { firestoreQueryService, type QueryResult } from '@/services/firestore';
import {
  type EntityType,
  type FileDomain,
  type FileCategory,
  FILE_LIFECYCLE_STATES,
  FILE_STATUS,
} from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { Photo } from '../../utils/PhotoItem';

const logger = createModuleLogger('usePhotosTabFetch');

// =============================================================================
// TYPES
// =============================================================================

export interface UsePhotosTabFetchParams {
  readonly entityType: EntityType;
  readonly entityId: string;
  readonly domain: FileDomain;
  readonly category: FileCategory;
  /** Skip subscription when false (e.g. inline creation, placeholder id). */
  readonly enabled?: boolean;
}

export interface UsePhotosTabFetchReturn {
  readonly photos: Photo[];
  readonly isLoading: boolean;
  readonly error: string | null;
}

// =============================================================================
// HOOK
// =============================================================================

interface FileRecordShape {
  id?: string;
  displayName?: string;
  originalFilename?: string;
  downloadUrl?: string;
  entityLabel?: string;
}

function toPhoto(raw: DocumentData, fallbackLabel: string): Photo | null {
  const record = raw as FileRecordShape;
  const id = typeof record.id === 'string' ? record.id : null;
  const src = typeof record.downloadUrl === 'string' ? record.downloadUrl : null;
  if (!id || !src) return null;

  const displayName = record.displayName ?? record.originalFilename ?? id;
  const label = record.entityLabel ?? fallbackLabel;

  return {
    id,
    src,
    alt: `${label} — ${displayName}`,
    name: displayName,
  };
}

export function usePhotosTabFetch(
  params: UsePhotosTabFetchParams,
): UsePhotosTabFetchReturn {
  const { entityType, entityId, domain, category, enabled = true } = params;
  const { user, loading: authLoading } = useAuth();
  const companyResult = useCompanyId();
  const companyId = companyResult?.companyId ?? null;

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    const shouldSkip =
      !enabled ||
      !user ||
      !companyId ||
      !entityId ||
      entityId === '__new__' ||
      entityId === 'placeholder';

    if (shouldSkip) {
      setPhotos([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const unsubscribe = firestoreQueryService.subscribe<DocumentData>(
      'FILES',
      (result: QueryResult<DocumentData>) => {
        const mapped: Photo[] = [];
        for (const raw of result.documents) {
          const photo = toPhoto(raw, entityId);
          if (photo) mapped.push(photo);
        }
        setPhotos(mapped);
        setIsLoading(false);
      },
      (err: unknown) => {
        const message = getErrorMessage(err, 'Failed to load entity photos');
        logger.error('Photos subscription error', {
          entityType,
          entityId,
          domain,
          category,
          error: message,
        });
        setError(message);
        setIsLoading(false);
      },
      {
        constraints: [
          where('entityType', '==', entityType),
          where('entityId', '==', entityId),
          where('domain', '==', domain),
          where('category', '==', category),
          where('status', '==', FILE_STATUS.READY),
          where('lifecycleState', '==', FILE_LIFECYCLE_STATES.ACTIVE),
        ],
      },
    );

    return () => {
      unsubscribe();
    };
  }, [authLoading, user, companyId, entityType, entityId, domain, category, enabled]);

  return { photos, isLoading, error };
}

export default usePhotosTabFetch;
