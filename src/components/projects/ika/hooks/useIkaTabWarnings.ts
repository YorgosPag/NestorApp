'use client';

import { useMemo } from 'react';
import { useProjectWorkers } from './useProjectWorkers';

export interface IkaTabWarnings {
  hasWorkersWithoutClass: boolean;
  isLoading: boolean;
}

/**
 * Derives IKA tab warning state from worker data.
 * SSoT: wraps useProjectWorkers (module-level cache → O(1) on second call).
 * hasWorkersWithoutClass: true when ≥1 worker has no insuranceClassId.
 */
export function useIkaTabWarnings(projectId: string | undefined): IkaTabWarnings {
  const { workers, isLoading } = useProjectWorkers(projectId);

  const hasWorkersWithoutClass = useMemo(
    () => workers.some((w) => !w.insuranceClassId),
    [workers],
  );

  return { hasWorkersWithoutClass, isLoading };
}
