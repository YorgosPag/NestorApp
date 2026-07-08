/**
 * useCompanyDisplayName — resolve a company's human-readable display name
 *
 * SSoT for the "fetch company, prefer companyName → tradeName → id" pattern
 * that was previously copy-pasted across FloorFloorplanInline, ParkingFloorplanTab
 * and StorageFloorplanTab. Pass `undefined` to skip the fetch (returns undefined).
 *
 * @module hooks/useCompanyDisplayName
 */

'use client';

import { useEffect, useState } from 'react';
import { getCompanyById } from '@/services/companies.service';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useCompanyDisplayName');

/**
 * Returns the display name for a company, or `undefined` while loading /
 * when no companyId is provided. Falls back to the raw id on error.
 */
export function useCompanyDisplayName(companyId?: string): string | undefined {
  const [displayName, setDisplayName] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!companyId) {
      setDisplayName(undefined);
      return;
    }

    let cancelled = false;

    const fetchCompanyName = async () => {
      try {
        const company = await getCompanyById(companyId);
        if (cancelled) return;
        if (company && company.type === 'company') {
          setDisplayName(company.companyName || company.tradeName || companyId);
        } else {
          setDisplayName(companyId);
        }
      } catch (error) {
        if (!cancelled) {
          logger.error('Failed to fetch company name', { error });
          setDisplayName(companyId);
        }
      }
    };

    fetchCompanyName();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return displayName;
}
