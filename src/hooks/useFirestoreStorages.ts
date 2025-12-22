'use client';

import { useState, useEffect } from 'react';
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

  const fetchStorages = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/storages');

      if (!response.ok) {
        throw new Error(`Failed to fetch storages: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setStorages(data.storages);
      } else {
        throw new Error(data.error || 'Failed to fetch storages');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ Error fetching storages:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStorages();
  }, []);

  return {
    storages,
    loading,
    error,
    refetch: fetchStorages
  };
}