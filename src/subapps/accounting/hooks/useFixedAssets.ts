/**
 * @fileoverview Accounting Subapp — useFixedAssets Hook
 * @description Η ΣΕΛΙΔΑ του μητρώου παγίων με δρομέα (ADR-ACC-010 §2.1.1 Φάση 3β) πάνω στο κοινό
 *   `useCursorPagedList`, και η δημιουργία παγίου.
 *   🔴 Ως 2026-10-15 διάβαζε `data.assets` — πεδίο που η διαδρομή δεν έστελνε ποτέ (`{ data: { items } }`) ⇒ το
 *   μητρώο έδειχνε ΠΑΝΤΑ «κανένα πάγιο».
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-10
 * @version 2.0.0
 * @see ADR-ACC-007 Fixed Assets & Depreciation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCursorPagedList, type CachedFirstPage, type UseCursorPagedListReturn } from '@/hooks/useCursorPagedList';
import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { createStaleCache } from '@/lib/stale-cache';
import type { FixedAsset, AssetCategory, AssetStatus, CreateFixedAssetInput } from '@/subapps/accounting/types';

// ADR-300: Module-level cache — survives React unmount/remount (navigation)
const fixedAssetsCache = createStaleCache<CachedFirstPage<FixedAsset>>('accounting-fixed-assets');

interface UseFixedAssetsOptions {
  /** Φίλτρο κατηγορίας */
  category?: AssetCategory;
  /** Φίλτρο κατάστασης */
  status?: AssetStatus;
  /** Φορολογικό έτος κτήσης */
  acquisitionYear?: number;
}

interface UseFixedAssetsReturn extends UseCursorPagedListReturn<FixedAsset> {
  /** Δημιουργία παγίου. Αποτυχία ⇒ ΠΕΤΑ (ο διάλογος δείχνει το σφάλμα). */
  createAsset: (data: CreateFixedAssetInput) => Promise<{ id: string }>;
}

export function useFixedAssets(options: UseFixedAssetsOptions = {}): UseFixedAssetsReturn {
  const { category, status, acquisitionYear } = options;
  const { user } = useAuth();
  const params = useMemo(() => ({ category, status, acquisitionYear }), [category, status, acquisitionYear]);

  const list = useCursorPagedList<FixedAsset>({
    url: API_ROUTES.ACCOUNTING.FIXED_ASSETS,
    params,
    enabled: user !== null,
    cache: fixedAssetsCache,
  });
  const { refetch } = list;

  const createAsset = useCallback(
    async (data: CreateFixedAssetInput): Promise<{ id: string }> => {
      const { assetId } = await apiClient.post<{ assetId: string }>(API_ROUTES.ACCOUNTING.FIXED_ASSETS, data);
      await refetch();
      return { id: assetId };
    },
    [refetch],
  );

  return { ...list, createAsset };
}
