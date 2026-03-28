'use client';

/**
 * @module useCriticalPath
 * @enterprise ADR-266 Phase C Sub-phase 2 — Critical Path hook
 *
 * Loads construction data via useConstructionGantt and computes CPM.
 * Used by CriticalPathCard in the Milestones view.
 */

import { useMemo } from 'react';
import { useConstructionGantt } from '@/components/building-management/hooks/useConstructionGantt';
import { computeCPM } from '@/services/construction-scheduling/cpm-calculator';
import type { CPMResult } from '@/services/construction-scheduling/cpm-types';

interface UseCriticalPathReturn {
  cpmResult: CPMResult | null;
  loading: boolean;
}

export function useCriticalPath(buildingId: string): UseCriticalPathReturn {
  const { phases, tasks, loading } = useConstructionGantt(buildingId);

  const cpmResult = useMemo((): CPMResult | null => {
    if (loading || tasks.length === 0) return null;
    return computeCPM(tasks, phases);
  }, [tasks, phases, loading]);

  return { cpmResult, loading };
}
