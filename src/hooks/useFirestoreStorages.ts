'use client';

import { useState, useEffect } from 'react';
// 🔐 ENTERPRISE: Auth-ready gating pattern
import { useAuth } from '@/auth/hooks/useAuth';
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { Storage } from '@/types/storage/contracts';

interface UseFirestoreStoragesReturn {
  storages: Storage[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * 🏢 ENTERPRISE: Response data type (apiClient returns unwrapped data)
 */
interface StoragesApiResponse {
  storages: Storage[];
  count?: number;
}

export function useFirestoreStorages(): UseFirestoreStoragesReturn {
  // 🔐 ENTERPRISE: Wait for auth state before making API calls
  const { user, loading: authLoading } = useAuth();

  const [storages, setStorages] = useState<Storage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStorages = async () => {
    try {
      // 🔐 AUTH-READY GATING - Wait for authentication
      if (authLoading) {
        // Auth state is still loading - wait for it
        console.log('⏳ [Storages] Waiting for auth state...');
        return; // Will retry via useEffect when authLoading changes
      }

      if (!user) {
        // User not authenticated - cannot proceed
        setLoading(false);
        setError('User not authenticated');
        return;
      }

      setLoading(true);
      setError(null);

      console.log('📦 [Storages] Fetching storages...');

      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      const data = await apiClient.get<StoragesApiResponse>('/api/storages');

      setStorages(data?.storages || []);
      console.log(`✅ [Storages] Loaded ${data?.storages?.length || 0} storages`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ [Storages] Error fetching storages:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 🏢 ENTERPRISE: Fetch storages when auth is ready
  useEffect(() => {
    if (!authLoading && user) {
      fetchStorages();
    }
  }, [authLoading, user]);

  return {
    storages,
    loading,
    error,
    refetch: fetchStorages
  };
}