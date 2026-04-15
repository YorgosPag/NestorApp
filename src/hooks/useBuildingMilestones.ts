'use client';

/**
 * useBuildingMilestones — Data hook for building milestones CRUD
 *
 * Uses centralized useAsyncData hook for data fetching (ADR-223).
 * CRUD operations trigger refetch for server-consistent state.
 */

import { useCallback } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import type { BuildingMilestone, MilestoneCreatePayload, MilestoneUpdatePayload } from '@/types/building/milestone';
import {
  getMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
} from '@/services/milestone-service';
import { useAsyncData } from '@/hooks/useAsyncData';
// 🏢 ADR-300: Stale-while-revalidate — prevents navigation flash on remount
import { createStaleCache } from '@/lib/stale-cache';

const logger = createModuleLogger('useBuildingMilestones');

// ADR-300: Module-level cache survives React unmount/remount (navigation)
// Keyed by buildingId
const buildingMilestonesCache = createStaleCache<BuildingMilestone[]>('building-milestones');

interface UseBuildingMilestonesReturn {
  milestones: BuildingMilestone[];
  loading: boolean;
  error: string | null;
  createMilestone: (payload: MilestoneCreatePayload) => Promise<boolean>;
  updateMilestone: (id: string, payload: MilestoneUpdatePayload) => Promise<boolean>;
  deleteMilestone: (id: string) => Promise<boolean>;
  reload: () => Promise<void>;
}

export function useBuildingMilestones(buildingId: string): UseBuildingMilestonesReturn {
  const { data, loading, error, refetch } = useAsyncData({
    fetcher: async () => {
      const result = await getMilestones(buildingId);
      // ADR-300: Write to module-level cache so next remount skips spinner
      buildingMilestonesCache.set(result, buildingId);
      return result;
    },
    deps: [buildingId],
    enabled: !!buildingId,
    initialData: buildingMilestonesCache.get(buildingId),
    silentInitialFetch: buildingMilestonesCache.hasLoaded(buildingId),
  });

  const milestones = data ?? [];

  // ─── CRUD Operations ───────────────────────────────────────────────

  const handleCreate = useCallback(
    async (payload: MilestoneCreatePayload): Promise<boolean> => {
      const result = await createMilestone(buildingId, payload);
      if (result.success) {
        await refetch();
      }
      return result.success;
    },
    [buildingId, refetch]
  );

  const handleUpdate = useCallback(
    async (id: string, payload: MilestoneUpdatePayload): Promise<boolean> => {
      const result = await updateMilestone(buildingId, id, payload);
      if (result.success) {
        await refetch();
      }
      return result.success;
    },
    [buildingId, refetch]
  );

  const handleDelete = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await deleteMilestone(buildingId, id);
      if (result.success) {
        await refetch();
      }
      return result.success;
    },
    [buildingId, refetch]
  );

  return {
    milestones,
    loading,
    error,
    createMilestone: handleCreate,
    updateMilestone: handleUpdate,
    deleteMilestone: handleDelete,
    reload: refetch,
  };
}
