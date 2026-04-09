/**
 * @fileoverview Hook for fetching photo share history per contact.
 * @module hooks/usePhotoShareHistory
 */

import { useState, useEffect } from 'react';
import { useCompanyId } from '@/hooks/useCompanyId';
import { getPhotoSharesByContact } from '@/services/photo-share-history.service';
import type { PhotoShareRecord } from '@/types/photo-share';

interface UsePhotoShareHistoryResult {
  shares: PhotoShareRecord[];
  isLoading: boolean;
  error: string | null;
  /** Total share count */
  totalCount: number;
}

/**
 * Fetches photo share history for a given contact.
 * Automatically resolves companyId from auth context.
 */
export function usePhotoShareHistory(
  contactId: string | undefined,
  limit = 50,
): UsePhotoShareHistoryResult {
  const companyIdResult = useCompanyId();
  const companyId = companyIdResult?.companyId;

  const [shares, setShares] = useState<PhotoShareRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contactId || !companyId) {
      setShares([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getPhotoSharesByContact(contactId, companyId, limit)
      .then((records) => {
        if (!cancelled) {
          setShares(records);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load share history');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [contactId, companyId, limit]);

  return {
    shares,
    isLoading,
    error,
    totalCount: shares.length,
  };
}
