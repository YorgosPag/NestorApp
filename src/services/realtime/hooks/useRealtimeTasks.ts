'use client';

/**
 * Real-time Tasks Hook
 *
 * Εγγράφεται στη συλλογή `TASKS` και υπολογίζει στατιστικά στον πελάτη.
 *
 * ⚠️ **Δύο ερωτήματα, δύο σπίτια** (ADR-798 §22 · ADR-749):
 *  - ο **κύκλος ζωής** της συνδρομής Firestore → `create-realtime-collection-hook.ts`
 *  - η **αισιόδοξη ενημέρωση** από το event bus → `use-realtime-entity-events.ts`
 *
 * Εδώ μένει **μόνο** η μετάφραση εγγράφου, ο αποκλεισμός των ακυρωμένων και ο
 * υπολογισμός των στατιστικών.
 *
 * @module services/realtime/hooks/useRealtimeTasks
 * @enterprise ADR-227 Phase 1 — Eliminate one-time fetches
 */

import { useMemo } from 'react';
import type { DocumentData } from 'firebase/firestore';
import type { CrmTask } from '@/types/crm';
import type { SubscriptionStatus } from '../types';
import { toTask } from '@/services/crm/tasks/mappers';
import { createModuleLogger } from '@/lib/telemetry';
import { isToday, isPast } from 'date-fns';
// 🏢 ADR-300: Stale-while-revalidate — prevents navigation flash on remount
import { createStaleCache } from '@/lib/stale-cache';
import { createRealtimeCollectionHook } from './create-realtime-collection-hook';
import { useRealtimeEntityEvents } from './use-realtime-entity-events';

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

/**
 * Μηδενικά στατιστικά — **ΈΝΑ** σημείο που ξέρει πώς μοιάζει το «μηδέν».
 *
 * 🔴 Ήταν γραμμένο **δύο φορές** — εδώ και στο `EMPTY_STATS` — και το
 * **CHECK 3.28** το κατήγγειλε ως **ενδο-αρχειακό κλώνο** (59 tokens). Μια
 * προσθήκη πεδίου στο `TaskStats` απαιτούσε **δύο** επεμβάσεις· ξεχασμένη η μία
 * δίνει `undefined` σε μετρητή — σιωπηλά, μόνο στο άδειο σκέλος.
 *
 * ⚠️ **Εργοστάσιο, όχι σταθερά**: το `computeStats` **μεταβάλλει** το αντικείμενο
 * (και τα εμφωλευμένα `byPriority`/`byType`) — κοινό στιγμιότυπο θα έγραφε
 * πάνω στο «μηδέν» όλων των καταναλωτών.
 */
function createEmptyStats(): TaskStats {
  return {
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
}

/** Το σταθερό «μηδέν» του άδειου σκέλους — ίδια ταυτότητα μεταξύ renders (`useMemo`). */
const EMPTY_STATS: TaskStats = createEmptyStats();

function computeStats(tasks: CrmTask[]): TaskStats {
  const stats: TaskStats = createEmptyStats();

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

// ============================================================================
// Η ΠΑΡΑΛΛΑΓΗ — ό,τι είναι γνήσια δικό του
// ============================================================================

const useTasksCollection = createRealtimeCollectionHook<DocumentData, CrmTask>({
  collection: 'TASKS',
  logger,
  cache: tasksCache,
  mapDocuments: (documents): CrmTask[] =>
    documents
      .map((doc) => toTask(doc as DocumentData & { id: string }))
      // Exclude cancelled (same filter as TasksRepository.getStats)
      .filter((task) => task.status !== 'cancelled'),
});

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useRealtimeTasks(enabled = true): UseRealtimeTasksReturn {
  const {
    items: tasks,
    setItems: setTasks,
    loading,
    error,
    status,
    refetch,
  } = useTasksCollection(enabled);

  // 🏢 ENTERPRISE: Event bus subscribers for optimistic UI updates (ADR-227 Phase 3)
  useRealtimeEntityEvents({
    created: 'TASK_CREATED',
    updated: 'TASK_UPDATED',
    deleted: 'TASK_DELETED',
    updatedId: (payload) => payload.taskId,
    updatedFields: (payload) => payload.updates as Partial<CrmTask>,
    deletedId: (payload) => payload.taskId,
    setItems: setTasks,
    refetch,
    logger,
  });

  const stats = useMemo(() => {
    if (tasks.length === 0) return EMPTY_STATS;
    return computeStats(tasks);
  }, [tasks]);

  return { tasks, stats, loading, error, status, refetch };
}

export default useRealtimeTasks;
