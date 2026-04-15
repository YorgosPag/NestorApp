'use client';

/**
 * Real-time Tasks Hook
 *
 * Canonical pattern from useRealtimeBuildings.ts.
 * Subscribes to TASKS collection and computes stats client-side.
 *
 * @module services/realtime/hooks/useRealtimeTasks
 * @enterprise ADR-227 Phase 1 — Eliminate one-time fetches
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { firestoreQueryService } from '@/services/firestore';
import type { QueryResult } from '@/services/firestore';
import type { DocumentData } from 'firebase/firestore';
import type { CrmTask } from '@/types/crm';
import type { SubscriptionStatus, TaskCreatedPayload, TaskUpdatedPayload, TaskDeletedPayload } from '../types';
import { RealtimeService } from '@/services/realtime';
import { toTask } from '@/services/crm/tasks/mappers';
import { applyUpdates } from '@/lib/utils';
import { createModuleLogger } from '@/lib/telemetry';
import { isToday, isPast } from 'date-fns';
// 🏢 ADR-300: Stale-while-revalidate — prevents navigation flash on remount
import { createStaleCache } from '@/lib/stale-cache';

const logger = createModuleLogger('useRealtimeTasks');

// ADR-300: Module-level cache survives React unmount/remount (navigation)
const tasksCache = createStaleCache<CrmTask[]>('tasks');

// ============================================================================
// TYPES
// ============================================================================

export interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  byPriority: Record<string, number>;
  byType: Record<string, number>;
}

interface UseRealtimeTasksReturn {
  tasks: CrmTask[];
  stats: TaskStats;
  loading: boolean;
  error: string | null;
  status: SubscriptionStatus;
  refetch: () => void;
}

// ============================================================================
// STATS COMPUTATION (mirrors TasksRepository.getStats)
// ============================================================================

function computeStats(tasks: CrmTask[]): TaskStats {
  const stats: TaskStats = {
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
    dueToday: 0,
    dueThisWeek: 0,
    byPriority: { low: 0, medium: 0, high: 0, urgent: 0 },
    byType: {},
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  tasks.forEach((task) => {
    stats.total++;
    if (task.status === 'pending') stats.pending++;
    if (task.status === 'in_progress') stats.inProgress++;
    if (task.status === 'completed') stats.completed++;

    stats.byPriority[task.priority] = (stats.byPriority[task.priority] || 0) + 1;
    stats.byType[task.type] = (stats.byType[task.type] || 0) + 1;

    if (task.dueDate) {
      const dueDate = new Date(task.dueDate as Date);
      if (
        (task.status === 'pending' || task.status === 'in_progress') &&
        isPast(dueDate) &&
        !isToday(dueDate)
      ) {
        stats.overdue++;
      }
      if (isToday(dueDate)) stats.dueToday++;
      if (dueDate >= today && dueDate <= weekFromNow) stats.dueThisWeek++;
    }
  });

  return stats;
}

const EMPTY_STATS: TaskStats = {
  total: 0, pending: 0, inProgress: 0, completed: 0,
  overdue: 0, dueToday: 0, dueThisWeek: 0,
  byPriority: { low: 0, medium: 0, high: 0, urgent: 0 },
  byType: {},
};

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useRealtimeTasks(enabled = true): UseRealtimeTasksReturn {
  // ADR-300: Seed from module-level cache → zero flash on re-navigation
  const [tasks, setTasks] = useState<CrmTask[]>(tasksCache.get() ?? []);
  const [loading, setLoading] = useState(enabled && !tasksCache.hasLoaded());
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SubscriptionStatus>('idle');
  const refreshTriggerRef = useRef(0);

  const refetch = useCallback(() => {
    refreshTriggerRef.current += 1;
    setLoading(true);
    setError(null);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      setLoading(false);
      return;
    }

    setStatus('connecting');
    // ADR-300: Only show spinner on first load — not on re-navigation
    if (!tasksCache.hasLoaded()) setLoading(true);

    const unsubscribe = firestoreQueryService.subscribe<DocumentData>(
      'TASKS',
      (result: QueryResult<DocumentData>) => {
        const mapped = result.documents.map((doc) =>
          toTask(doc as DocumentData & { id: string })
        );

        // Exclude cancelled (same filter as TasksRepository.getStats)
        const activeTasks = mapped.filter((t) => t.status !== 'cancelled');

        logger.info('Received tasks in real-time', { count: activeTasks.length });

        // ADR-300: Write to module-level cache so next remount skips spinner
        tasksCache.set(activeTasks);
        setTasks(activeTasks);
        setLoading(false);
        setError(null);
        setStatus('active');
      },
      (err: Error) => {
        logger.error('Firestore error', { error: err.message });
        setError(err.message);
        setLoading(false);
        setStatus('error');
      }
    );

    return () => {
      logger.info('Cleaning up tasks subscription');
      unsubscribe();
    };
  }, [enabled, refreshTriggerRef.current]);

  // 🏢 ENTERPRISE: Event bus subscribers for optimistic UI updates (ADR-227 Phase 3)
  useEffect(() => {
    const handleTaskCreated = (_payload: TaskCreatedPayload) => {
      logger.info('Task created, triggering refetch');
      refetch();
    };

    const handleTaskUpdated = (payload: TaskUpdatedPayload) => {
      logger.info('Applying optimistic update for task', { taskId: payload.taskId });
      setTasks(prev => prev.map(task =>
        task.id === payload.taskId
          ? applyUpdates(task, payload.updates as Partial<CrmTask>)
          : task
      ));
    };

    const handleTaskDeleted = (payload: TaskDeletedPayload) => {
      logger.info('Removing deleted task from list', { taskId: payload.taskId });
      setTasks(prev => prev.filter(task => task.id !== payload.taskId));
    };

    const unsubCreate = RealtimeService.subscribe('TASK_CREATED', handleTaskCreated);
    const unsubUpdate = RealtimeService.subscribe('TASK_UPDATED', handleTaskUpdated);
    const unsubDelete = RealtimeService.subscribe('TASK_DELETED', handleTaskDeleted);

    return () => {
      unsubCreate();
      unsubUpdate();
      unsubDelete();
    };
  }, [refetch]);

  const stats = useMemo(() => {
    if (tasks.length === 0) return EMPTY_STATS;
    return computeStats(tasks);
  }, [tasks]);

  return { tasks, stats, loading, error, status, refetch };
}

export default useRealtimeTasks;
