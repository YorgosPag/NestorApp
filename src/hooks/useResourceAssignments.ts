'use client';

/**
 * @module useResourceAssignments
 * @enterprise ADR-266 Phase C, Sub-phase 4 — Resource Allocation
 *
 * React hook for CRUD operations on resource assignments.
 * Loads all assignments for a building (or optionally filtered by taskId).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  fetchResourceAssignments,
  createResourceAssignment,
  updateResourceAssignment,
  deleteResourceAssignment,
} from '@/services/construction-scheduling/resource-assignment.service';
import type {
  ConstructionResourceAssignment,
  ResourceAssignmentCreatePayload,
  ResourceAssignmentUpdatePayload,
} from '@/types/building/construction';

export interface UseResourceAssignmentsReturn {
  assignments: ConstructionResourceAssignment[];
  loading: boolean;
  error: string | null;
  /** Create a new resource assignment */
  addAssignment: (payload: ResourceAssignmentCreatePayload) => Promise<{ success: boolean; error?: string }>;
  /** Update an existing assignment (hours/notes) */
  editAssignment: (id: string, updates: ResourceAssignmentUpdatePayload) => Promise<{ success: boolean; error?: string }>;
  /** Delete an assignment */
  removeAssignment: (id: string) => Promise<{ success: boolean; error?: string }>;
  /** Refresh the list */
  refetch: () => Promise<void>;
}

interface UseResourceAssignmentsOptions {
  buildingId: string;
  /** Optional: filter by task ID */
  taskId?: string;
}

export function useResourceAssignments({
  buildingId,
  taskId,
}: UseResourceAssignmentsOptions): UseResourceAssignmentsReturn {
  const [assignments, setAssignments] = useState<ConstructionResourceAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Fetch ──────────────────────────────────────────────────────────
  const fetchList = useCallback(async () => {
    if (!buildingId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchResourceAssignments(buildingId, taskId);
      setAssignments(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [buildingId, taskId]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  // ─── Create ─────────────────────────────────────────────────────────
  const addAssignment = useCallback(async (payload: ResourceAssignmentCreatePayload) => {
    const result = await createResourceAssignment(buildingId, payload);
    if (result.success) {
      await fetchList();
    }
    return result;
  }, [buildingId, fetchList]);

  // ─── Update ─────────────────────────────────────────────────────────
  const editAssignment = useCallback(async (id: string, updates: ResourceAssignmentUpdatePayload) => {
    const result = await updateResourceAssignment(buildingId, id, updates);
    if (result.success) {
      // Optimistic update for responsiveness
      setAssignments(prev => prev.map(a =>
        a.id === id ? { ...a, ...updates } : a
      ));
    }
    return result;
  }, [buildingId]);

  // ─── Delete ─────────────────────────────────────────────────────────
  const removeAssignment = useCallback(async (id: string) => {
    const result = await deleteResourceAssignment(buildingId, id);
    if (result.success) {
      setAssignments(prev => prev.filter(a => a.id !== id));
    }
    return result;
  }, [buildingId]);

  return {
    assignments,
    loading,
    error,
    addAssignment,
    editAssignment,
    removeAssignment,
    refetch: fetchList,
  };
}
