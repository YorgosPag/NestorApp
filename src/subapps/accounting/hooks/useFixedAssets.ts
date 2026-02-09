/**
 * @fileoverview Accounting Subapp — useFixedAssets Hook
 * @description Client-side hook για πάγια στοιχεία με φίλτρα και δημιουργία
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-007 Fixed Assets & Depreciation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type {
  FixedAsset,
  AssetCategory,
  AssetStatus,
  CreateFixedAssetInput,
} from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface UseFixedAssetsOptions {
  /** Φίλτρο κατηγορίας */
  category?: AssetCategory;
  /** Φίλτρο κατάστασης */
  status?: AssetStatus;
  /** Φορολογικό έτος κτήσης */
  acquisitionYear?: number;
  /** Αυτόματο fetch κατά το mount (default: true) */
  autoFetch?: boolean;
}

interface UseFixedAssetsReturn {
  /** Λίστα παγίων */
  assets: FixedAsset[];
  /** Κατάσταση φόρτωσης */
  loading: boolean;
  /** Μήνυμα σφάλματος */
  error: string | null;
  /** Ανανέωση δεδομένων */
  refetch: () => Promise<void>;
  /** Δημιουργία νέου παγίου */
  createAsset: (data: CreateFixedAssetInput) => Promise<{ id: string } | null>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useFixedAssets(options: UseFixedAssetsOptions = {}): UseFixedAssetsReturn {
  const { category, status, acquisitionYear, autoFetch = true } = options;
  const { user } = useAuth();

  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const buildQueryString = useCallback((): string => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (status) params.set('status', status);
    if (acquisitionYear !== undefined) params.set('acquisitionYear', String(acquisitionYear));
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [category, status, acquisitionYear]);

  const fetchAssets = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const headers = await getAuthHeaders();
      const queryString = buildQueryString();
      const response = await fetch(`/api/accounting/fixed-assets${queryString}`, { headers });

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error ?? `HTTP ${response.status}`);
      }

      const data: { assets: FixedAsset[] } = await response.json();
      setAssets(data.assets);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'accounting.errors.fixedAssetsLoadFailed';
      setError(message);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [user, getAuthHeaders, buildQueryString]);

  const createAsset = useCallback(
    async (data: CreateFixedAssetInput): Promise<{ id: string } | null> => {
      if (!user) return null;

      try {
        setError(null);
        const headers = await getAuthHeaders();
        const response = await fetch('/api/accounting/fixed-assets', {
          method: 'POST',
          headers,
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData: { error?: string } = await response.json();
          throw new Error(errorData.error ?? `HTTP ${response.status}`);
        }

        const result: { id: string } = await response.json();
        await fetchAssets();
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'accounting.errors.fixedAssetCreateFailed';
        setError(message);
        return null;
      }
    },
    [user, getAuthHeaders, fetchAssets],
  );

  useEffect(() => {
    if (autoFetch && user) {
      fetchAssets();
    }
  }, [autoFetch, user, fetchAssets]);

  return {
    assets,
    loading,
    error,
    refetch: fetchAssets,
    createAsset,
  };
}
