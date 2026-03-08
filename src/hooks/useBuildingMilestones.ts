'use client';

/**
 * useBuildingMilestones — Data hook for building milestones CRUD
 *
 * Loads milestones from Firestore via API, provides CRUD handlers.
 * Pattern follows: src/components/building-management/hooks/useConstructionGantt.ts
 */

import { useCallback, useEffect, useState } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import type { BuildingMilestone, MilestoneCreatePayload, MilestoneUpdatePayload } from '@/types/building/milestone';
import {
  getMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
} from '@/services/milestone-service';

const logger = createModuleLogger('useBuildingMilestones');

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
  const [milestones, setMilestones] = useState<BuildingMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Load Data ──────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!buildingId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getMilestones(buildingId);
      setMilestones(data);
    } catch (err) {
      logger.error('Error loading milestones', { error: err });
      setError(err instanceof Error ? err.message : 'Failed to load milestones');
    } finally {
      setLoading(false);
    }
  }, [buildingId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── CRUD Operations ───────────────────────────────────────────────

  const handleCreate = useCallback(
    async (payload: MilestoneCreatePayload): Promise<boolean> => {
      const result = await createMilestone(buildingId, payload);
      if (result.success) {
        await loadData();
      }
      return result.success;
    },
    [buildingId, loadData]
  );

  const handleUpdate = useCallback(
    async (id: string, payload: MilestoneUpdatePayload): Promise<boolean> => {
      const result = await updateMilestone(buildingId, id, payload);
      if (result.success) {
        await loadData();
      }
      return result.success;
    },
    [buildingId, loadData]
  );

  const handleDelete = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await deleteMilestone(buildingId, id);
      if (result.success) {
        await loadData();
      }
      return result.success;
    },
    [buildingId, loadData]
  );

  return {
    milestones,
    loading,
    error,
    createMilestone: handleCreate,
    updateMilestone: handleUpdate,
    deleteMilestone: handleDelete,
    reload: loadData,
  };
}
