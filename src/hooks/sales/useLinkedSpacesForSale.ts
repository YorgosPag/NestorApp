'use client';

/**
 * @fileoverview Hook for managing linked spaces (appurtenances) in sale dialogs
 * @description Resolves linked parking/storage spaces from a unit, provides
 *              checkbox state management, price editing, and builds payloads
 *              for the accounting bridge and appurtenance-sync API.
 * @see ADR-199 Sales Appurtenances
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { Unit, LinkedSpace } from '@/types/unit';
import type { SpaceInclusionType } from '@/config/domain-constants';
import type { SaleLineItem } from '@/services/sales-accounting/types';

// =============================================================================
// TYPES
// =============================================================================

/** Enriched linked space with resolved display data */
export interface ResolvedLinkedSpace {
  spaceId: string;
  spaceType: 'parking' | 'storage';
  inclusion: SpaceInclusionType;
  allocationCode: string;
  displayName: string;
  checked: boolean;
  salePrice: number;
  isRented: boolean;
}

interface SyncSpacePayload {
  spaceId: string;
  spaceType: 'parking' | 'storage';
  salePrice: number | null;
}

interface UseLinkedSpacesForSaleResult {
  spaces: ResolvedLinkedSpace[];
  loading: boolean;
  hasSpaces: boolean;
  totalAppurtenancesPrice: number;
  toggleSpace: (spaceId: string) => void;
  setSpacePrice: (spaceId: string, price: number) => void;
  getSelectedSpaces: () => ResolvedLinkedSpace[];
  buildLineItems: (unitPrice: number, unitName: string) => SaleLineItem[];
  buildSyncPayload: (action: 'reserve' | 'sell' | 'revert') => SyncSpacePayload[];
}

// =============================================================================
// HELPERS
// =============================================================================

function isDefaultChecked(inclusion: SpaceInclusionType): boolean {
  return inclusion === 'included' || inclusion === 'rented';
}

function buildDisplayName(space: LinkedSpace): string {
  const code = space.allocationCode ?? space.spaceId.slice(0, 8);
  const prefix = space.spaceType === 'parking' ? 'P' : 'S';
  return code.startsWith(prefix) ? code : `${prefix}-${code}`;
}

// =============================================================================
// HOOK
// =============================================================================

export function useLinkedSpacesForSale(unit: Unit): UseLinkedSpacesForSaleResult {
  const [spaces, setSpaces] = useState<ResolvedLinkedSpace[]>([]);
  const [loading, setLoading] = useState(false);

  // Resolve linked spaces when unit changes
  useEffect(() => {
    const linkedSpaces = unit.linkedSpaces;
    if (!linkedSpaces || linkedSpaces.length === 0) {
      setSpaces([]);
      return;
    }

    setLoading(true);

    // Resolve prices from Firestore for each linked space
    const resolveSpaces = async () => {
      try {
        const resolved = await Promise.all(
          linkedSpaces
            .filter((ls): ls is LinkedSpace & { spaceType: 'parking' | 'storage' } =>
              ls.spaceType === 'parking' || ls.spaceType === 'storage'
            )
            .map(async (ls) => {
              let resolvedPrice = ls.salePrice ?? 0;

              // Try to fetch current asking price from the space document
              if (resolvedPrice === 0) {
                try {
                  const endpoint = ls.spaceType === 'parking'
                    ? `/api/parking/${ls.spaceId}`
                    : `/api/storage/${ls.spaceId}`;
                  const data = await apiClient.get<{ commercial?: { askingPrice?: number } }>(endpoint);
                  resolvedPrice = data?.commercial?.askingPrice ?? 0;
                } catch {
                  // Space might not have a price — that's OK
                }
              }

              return {
                spaceId: ls.spaceId,
                spaceType: ls.spaceType,
                inclusion: ls.inclusion,
                allocationCode: ls.allocationCode ?? '',
                displayName: buildDisplayName(ls),
                checked: isDefaultChecked(ls.inclusion),
                salePrice: resolvedPrice,
                isRented: ls.inclusion === 'rented',
              };
            })
        );

        setSpaces(resolved);
      } catch {
        // Silently fail — spaces remain empty
        setSpaces([]);
      } finally {
        setLoading(false);
      }
    };

    resolveSpaces();
  }, [unit.id, unit.linkedSpaces]);

  const toggleSpace = useCallback((spaceId: string) => {
    setSpaces((prev) =>
      prev.map((s) => (s.spaceId === spaceId ? { ...s, checked: !s.checked } : s))
    );
  }, []);

  const setSpacePrice = useCallback((spaceId: string, price: number) => {
    setSpaces((prev) =>
      prev.map((s) => (s.spaceId === spaceId ? { ...s, salePrice: price } : s))
    );
  }, []);

  const getSelectedSpaces = useCallback((): ResolvedLinkedSpace[] => {
    return spaces.filter((s) => s.checked);
  }, [spaces]);

  const totalAppurtenancesPrice = useMemo(
    () => spaces.filter((s) => s.checked).reduce((sum, s) => sum + s.salePrice, 0),
    [spaces]
  );

  const hasSpaces = spaces.length > 0;

  const buildLineItems = useCallback(
    (unitPrice: number, unitName: string): SaleLineItem[] => {
      const items: SaleLineItem[] = [
        {
          assetId: unit.id,
          assetType: 'unit',
          assetName: unitName,
          grossAmount: unitPrice,
        },
      ];

      for (const space of spaces) {
        if (space.checked && space.salePrice > 0) {
          items.push({
            assetId: space.spaceId,
            assetType: space.spaceType,
            assetName: space.displayName,
            grossAmount: space.salePrice,
          });
        }
      }

      return items;
    },
    [unit.id, spaces]
  );

  const buildSyncPayload = useCallback(
    (action: 'reserve' | 'sell' | 'revert'): SyncSpacePayload[] => {
      const selected = action === 'revert' ? spaces : spaces.filter((s) => s.checked);
      return selected.map((s) => ({
        spaceId: s.spaceId,
        spaceType: s.spaceType,
        salePrice: s.salePrice > 0 ? s.salePrice : null,
      }));
    },
    [spaces]
  );

  return {
    spaces,
    loading,
    hasSpaces,
    totalAppurtenancesPrice,
    toggleSpace,
    setSpacePrice,
    getSelectedSpaces,
    buildLineItems,
    buildSyncPayload,
  };
}
