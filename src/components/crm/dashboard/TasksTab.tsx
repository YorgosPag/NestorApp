/* eslint-disable design-system/prefer-design-system-imports */
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { completeTaskWithPolicy, deleteTaskWithPolicy } from '@/services/crm/crm-mutation-gateway';
// 🏢 ENTERPRISE: Use CLIENT service - Server Action has NO auth context!
import { getOpportunitiesClient as getOpportunities } from '@/services/opportunities-client.service';
// 🏢 ENTERPRISE: Real-time tasks (ADR-227 Phase 1)
import { useRealtimeTasks } from '@/services/realtime';
import { Clock } from 'lucide-react';
import { isPast, isToday, isTomorrow } from 'date-fns';
import { useNotifications } from '@/providers/NotificationProvider';
import CreateTaskModal from './dialogs/CreateTaskModal';
import { TaskEditDialog } from './dialogs/TaskEditDialog';
import type { CrmTask, Opportunity } from '@/types/crm';
import type { AppointmentDocument } from '@/types/appointment';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('TasksTab');
// ADR-229 Phase 2: Centralized loading/error states
import { PageLoadingState, PageErrorState } from '@/core/states';
// 🏢 ENTERPRISE: Auth hook for race condition prevention
import { useAuth } from '@/auth/contexts/AuthContext';
import { createStaleCache } from '@/lib/stale-cache';

const crmDashboardLeadsCache = createStaleCache<Opportunity[]>('crm-dashboard-tasks');

import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
// 🏢 ENTERPRISE: Centralized filter state (from AdvancedFiltersPanel configs)
import { defaultTaskFilters } from '@/components/core/AdvancedFilters/configs';
import type { TaskFilterState } from '@/components/core/AdvancedFilters/configs';
// 🏢 ENTERPRISE: SSoT card + shared activity types
import { TaskListCard } from '@/domain/cards/task';
import {
  TASK_TYPE_ICONS,
  PRIORITY_BADGE_VARIANT,
  STATUS_BADGE_VARIANT,
  resolveAppointmentDate,
} from '@/components/crm/tasks/task-activity';
import type { ActivityItem } from '@/components/crm/tasks/task-activity';

// Re-export for backward compat (TaskDetailPanel imports these from here)
export { TASK_TYPE_ICONS, PRIORITY_BADGE_VARIANT, STATUS_BADGE_VARIANT, resolveAppointmentDate };
export type { ActivityItem };

interface TaskMetadata {
    location?: string;
    [key: string]: unknown;
}

interface TasksTabProps {
  /** Centralized filters from AdvancedFiltersPanel (page level). Uses defaults if not provided. */
  filters?: TaskFilterState;
  onTaskCreated?: () => void;
  /** Legacy: passed from GenericCRMDashboardTabsRenderer */
  selectedPeriod?: string;
  /** Appointments to merge into the unified activity list */
  appointments?: AppointmentDocument[];
  /** External leads from parent — skips internal fetch when provided */
  externalLeads?: Opportunity[];
  /** Split-layout mode: cards become clickable, inline actions hidden */
  selectionMode?: boolean;
  selectedActivityId?: string;
  onSelectActivity?: (item: ActivityItem) => void;
  /** Callback fired when the visible activity count changes */
  onCountChange?: (count: number) => void;
}

export function TasksTab({ filters: externalFilters, onTaskCreated, appointments, externalLeads, selectionMode = false, selectedActivityId, onSelectActivity, onCountChange }: TasksTabProps) {
  // 🏢 ENTERPRISE: Use externally provided filters or defaults
  const filters = externalFilters ?? defaultTaskFilters;
  const { success, error: notifyError } = useNotifications();
  const colors = useSemanticColors();
  const { t } = useTranslation(['crm', 'crm-inbox']);
  // 🏢 ENTERPRISE: Auth context for race condition prevention
  const { isAuthenticated, loading: authLoading } = useAuth();
  const sp = useSpacingTokens();
  const { confirm, dialogProps } = useConfirmDialog();
  // 🏢 ENTERPRISE: Real-time tasks (ADR-227 Phase 1) — replaces one-time getTasks()
  const { tasks, loading: tasksLoading, error: tasksError } = useRealtimeTasks(!authLoading && isAuthenticated);
  const [internalLeads, setInternalLeads] = useState<Opportunity[]>(
    externalLeads !== undefined ? [] : (crmDashboardLeadsCache.get() ?? [])
  );
  const [leadsLoading, setLeadsLoading] = useState(
    externalLeads === undefined && !crmDashboardLeadsCache.hasLoaded()
  );
  const effectiveLeads = externalLeads ?? internalLeads;
  const [editingTask, setEditingTask] = useState<CrmTask | null>(null);

  // Leads remain one-time fetch (no real-time needed for lead name lookup)
  const fetchLeads = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      if (!crmDashboardLeadsCache.hasLoaded()) setLeadsLoading(true);
      const leadsData = await getOpportunities();
      crmDashboardLeadsCache.set(leadsData);
      setInternalLeads(leadsData);
    } catch (err) {
      logger.error('Error fetching leads', { error: err });
    } finally {
      setLeadsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (externalLeads !== undefined) return;
    if (!authLoading && isAuthenticated) {
      fetchLeads();
    }
  }, [authLoading, isAuthenticated, fetchLeads, externalLeads]);

  const loading = tasksLoading || leadsLoading;
  const error = tasksError;

  const filteredTasks = useMemo(() => {
    let list = [...tasks];

    if (filters.status !== 'all') list = list.filter(t => t.status === filters.status);
    if (filters.priority !== 'all') list = list.filter(t => t.priority === filters.priority);
    if (filters.type !== 'all') list = list.filter(t => t.type === filters.type);

    if (filters.timeframe !== 'all') {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekFromNow = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

      list = list.filter(t => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate as string);
        switch (filters.timeframe) {
          case 'overdue': return isPast(d) && !isToday(d) && t.status !== 'completed';
          case 'today': return isToday(d);
          case 'tomorrow': return isTomorrow(d);
          case 'week': return d >= todayStart && d <= weekFromNow;
          default: return true;
        }
      });
    }

    if (filters.searchTerm) {
      const q = filters.searchTerm.toLowerCase();
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      const da = a.dueDate ? new Date(a.dueDate as string).getTime() : Infinity;
      const db = b.dueDate ? new Date(b.dueDate as string).getTime() : Infinity;
      return da - db;
    });

    return list;
  }, [tasks, filters]);

  const activityItems = useMemo<ActivityItem[]>(() => {
    const activityType = filters.activityType ?? 'all';
    const items: ActivityItem[] = [];

    if (activityType !== 'appointments') {
      for (const task of filteredTasks) {
        const d = task.dueDate ? new Date(task.dueDate as string).getTime() : Infinity;
        items.push({ kind: 'task', task, sortDate: d });
      }
    }

    if (activityType !== 'tasks' && appointments?.length) {
      const q = filters.searchTerm?.toLowerCase() ?? '';
      for (const appt of appointments) {
        const flat = appt as unknown as Record<string, unknown>;
        const desc = appt.appointment?.description ?? (flat['notes'] as string | undefined) ?? '';
        const name = appt.requester?.name ?? appt.requester?.email ?? null;
        if (q && !desc.toLowerCase().includes(q) && !(name ?? '').toLowerCase().includes(q)) continue;
        const date = resolveAppointmentDate(appt);
        const titleText = name ? `${name} — ${desc.slice(0, 60)}` : desc.slice(0, 80) || 'Ραντεβού';
        items.push({ kind: 'appointment', appt, sortDate: date?.getTime() ?? Infinity, title: titleText, date });
      }
    }

    items.sort((a, b) => a.sortDate - b.sortDate);
    return items;
  }, [filteredTasks, appointments, filters.activityType, filters.searchTerm]);

  useEffect(() => {
    onCountChange?.(activityItems.length);
  }, [activityItems.length, onCountChange]);

  const handleCompleteTask = useCallback(async (taskId?: string, taskTitle?: string) => {
    if (!taskId || !taskTitle) return;
    try {
      await completeTaskWithPolicy({ taskId });
      success(t('tasks.messages.completed', { title: taskTitle }));
    } catch {
      notifyError(t('tasks.messages.completeError'));
    }
  }, [t, success, notifyError]);

  const handleDeleteTask = useCallback(async (taskId?: string, taskTitle?: string) => {
    if (!taskId || !taskTitle) return;
    const confirmed = await confirm({
      title: t('tasks.messages.deleteConfirm', { title: taskTitle }),
      description: t('tasks.messages.deleteConfirm', { title: taskTitle }),
      variant: 'destructive',
    });
    if (confirmed) {
      try {
        await deleteTaskWithPolicy({ taskId });
        success(t('tasks.messages.deleted', { title: taskTitle }));
      } catch {
        notifyError(t('tasks.messages.deleteError'));
      }
    }
  }, [t, confirm, success, notifyError]);

  const getLeadName = useCallback(
    (leadId?: string) => effectiveLeads.find(l => l.id === leadId)?.fullName ?? null,
    [effectiveLeads]
  );

  const getItemId = (item: ActivityItem) =>
    item.kind === 'task' ? item.task.id : `appt_${item.appt.id}`;

  // ADR-229 Phase 2: Centralized loading/error states
  if (loading) {
    return <PageLoadingState icon={Clock} message={t('tasks.loading')} layout="contained" />;
  }

  if (error) {
    return <PageErrorState title={t('tasks.errorTitle')} message={error} layout="contained" />;
  }

  return (
    <div className={`${sp.padding.sm} ${sp.spaceBetween.sm}`}>
      <ConfirmDialog {...dialogProps} />
      {activityItems.length === 0 ? (
        <div className={`text-center ${sp.padding.y['2xl']}`}>
          <p className={colors.text.muted}>{t('tasks.noActivities')}</p>
        </div>
      ) : (
        activityItems.map((item) => (
          <TaskListCard
            key={getItemId(item)}
            item={item}
            isSelected={selectionMode && selectedActivityId === getItemId(item)}
            onSelect={onSelectActivity ? () => onSelectActivity(item) : undefined}
            getLeadName={getLeadName}
            onComplete={!selectionMode ? (task) => handleCompleteTask(task.id, task.title) : undefined}
            onEdit={!selectionMode ? setEditingTask : undefined}
            onDelete={!selectionMode ? (task) => handleDeleteTask(task.id, task.title) : undefined}
          />
        ))
      )}
      <CreateTaskModal isOpen={false} onClose={() => {}} onTaskCreated={() => { onTaskCreated?.(); }} />
      {editingTask && (
        <TaskEditDialog
          task={editingTask}
          open={!!editingTask}
          onOpenChange={(open) => { if (!open) setEditingTask(null); }}
          onUpdated={() => { setEditingTask(null); }}
        />
      )}
    </div>
  );
}
