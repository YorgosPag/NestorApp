'use client';

import { useState, useEffect } from 'react';
import type { Building } from '@/types/building/contracts';

interface UseFirestoreBuildingsReturn {
  buildings: Building[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFirestoreBuildings(): UseFirestoreBuildingsReturn {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBuildings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/buildings');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch buildings: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setBuildings(data.buildings);
      } else {
        throw new Error(data.error || 'Failed to fetch buildings');
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ Error fetching buildings:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuildings();
  }, []);

  return {
    buildings,
    loading,
    error,
    refetch: fetchBuildings
  };
}