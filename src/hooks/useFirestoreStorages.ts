'use client';

import { useState, useEffect, useCallback } from 'react';
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { Storage } from '@/types/storage/contracts';

interface UseFirestoreStoragesReturn {
  storages: Storage[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFirestoreStorages(): UseFirestoreStoragesReturn {
  const [storages, setStorages] = useState<Storage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStorages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      interface StoragesApiResponse {
        storages: Storage[];
      }

      const data = await apiClient.get<StoragesApiResponse>('/api/storages');

      setStorages(data?.storages || []);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ Error fetching storages:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStorages();
  }, [fetchStorages]);

  return {
    storages,
    loading,
    error,
    refetch: fetchStorages
  };
}