/* eslint-disable design-system/prefer-design-system-imports */
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { completeTaskWithPolicy, deleteTaskWithPolicy } from '@/services/crm/crm-mutation-gateway';
// 🏢 ENTERPRISE: Use CLIENT service - Server Action has NO auth context!
import { getOpportunitiesClient as getOpportunities } from '@/services/opportunities-client.service';
// 🏢 ENTERPRISE: Real-time tasks (ADR-227 Phase 1)
import { useRealtimeTasks } from '@/services/realtime';
import {
  Clock,
  CheckCircle,
  Phone,
  Users,
  Calendar,
  Mail,
  FileText,
  AlertCircle,
  Edit3,
  Trash2,
  User,
  MapPin,
} from 'lucide-react';
import { format, isToday, isPast, isTomorrow } from 'date-fns';
import { el } from 'date-fns/locale';
import { useNotifications } from '@/providers/NotificationProvider';
import { Button } from '@/components/ui/button';
import CreateTaskModal from './dialogs/CreateTaskModal';
import { TaskEditDialog } from './dialogs/TaskEditDialog';
import type { CrmTask, Opportunity, FirestoreishTimestamp } from '@/types/crm';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('TasksTab');
// ADR-229 Phase 2: Centralized loading/error states
import { PageLoadingState, PageErrorState } from '@/core/states';
import type { CrmTaskType, CrmTaskPriority, CrmTaskStatus } from '@/types/crm-extra';
import { HOVER_SHADOWS } from '@/components/ui/effects';
// 🏢 ENTERPRISE: Auth hook for race condition prevention
import { useAuth } from '@/auth/contexts/AuthContext';
import { SafeHTMLContent } from '@/components/shared/email/EmailContentRenderer';
// 🏢 ENTERPRISE: Centralized Badge component (replaces raw <span> badges)
import { Badge } from '@/components/ui/badge';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
// 🏢 ENTERPRISE: Centralized typography & spacing tokens
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
// 🏢 ENTERPRISE: Centralized filter state (from AdvancedFiltersPanel configs)
import { defaultTaskFilters } from '@/components/core/AdvancedFilters/configs';
import type { TaskFilterState } from '@/components/core/AdvancedFilters/configs';

interface TaskMetadata {
    location?: string;
    [key: string]: unknown;
}

const TASK_TYPE_ICONS: Record<CrmTaskType, React.ElementType> = {
  call: Phone,
  meeting: Users,
  viewing: Calendar,
  follow_up: AlertCircle,
  email: Mail,
  document: FileText,
  complaint: AlertCircle,
  other: Clock,
};

// 🏢 ENTERPRISE: Badge variant mappings for centralized Badge component
const PRIORITY_BADGE_VARIANT: Record<CrmTaskPriority, 'success' | 'warning' | 'info' | 'error'> = {
  low: 'success',
  medium: 'warning',
  high: 'info',
  urgent: 'error',
};

const STATUS_BADGE_VARIANT: Record<CrmTaskStatus, 'info' | 'warning' | 'success' | 'muted'> = {
  pending: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'muted',
};

const getDateColor = (dueDate?: FirestoreishTimestamp, status?: CrmTaskStatus, colors?: ReturnType<typeof useSemanticColors>) => {
    if (!colors) return 'text-gray-600'; // Fallback
    if (status === 'completed') return colors.text.success;
    if (!dueDate) return colors.text.muted;
    const date = new Date(dueDate as string); // Assuming string | Date
    if (isPast(date) && !isToday(date)) return colors.text.error;
    if (isToday(date)) return colors.text.info;
    if (isTomorrow(date)) return colors.text.accent;
    return colors.text.muted;
};

const createFormatDueDate = (t: (key: string) => string) => (dueDate?: FirestoreishTimestamp) => {
    if (!dueDate) return t('tasks.noDate');
    const date = new Date(dueDate as string);
    if (isToday(date)) return `${t('tasks.today')} ${format(date, 'HH:mm')}`;
    if (isTomorrow(date)) return `${t('tasks.tomorrow')} ${format(date, 'HH:mm')}`;
    if (isPast(date)) return `${t('tasks.overdue')} ${format(date, 'dd/MM HH:mm')}`;
    return format(date, 'dd/MM/yyyy HH:mm', { locale: el });
};

interface TasksTabProps {
  /** Centralized filters from AdvancedFiltersPanel (page level). Uses defaults if not provided. */
  filters?: TaskFilterState;
  onTaskCreated?: () => void;
  /** Legacy: passed from GenericCRMDashboardTabsRenderer */
  selectedPeriod?: string;
}

export function TasksTab({ filters: externalFilters, onTaskCreated }: TasksTabProps) {
  // 🏢 ENTERPRISE: Use externally provided filters or defaults
  const filters = externalFilters ?? defaultTaskFilters;
  const { success, error: notifyError } = useNotifications();
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation('crm');
  // 🏢 ENTERPRISE: Auth context for race condition prevention
  const { isAuthenticated, loading: authLoading } = useAuth();
  const typography = useTypography();
  const sp = useSpacingTokens();
  const { confirm, dialogProps } = useConfirmDialog();
  const formatDueDate = useMemo(() => createFormatDueDate(t), [t]);
  // 🏢 ENTERPRISE: Real-time tasks (ADR-227 Phase 1) — replaces one-time getTasks()
  const { tasks, loading: tasksLoading, error: tasksError } = useRealtimeTasks(!authLoading && isAuthenticated);
  const [leads, setLeads] = useState<Opportunity[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CrmTask | null>(null);

  // Leads remain one-time fetch (no real-time needed for lead name lookup)
  const fetchLeads = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLeadsLoading(true);
      const leadsData = await getOpportunities();
      setLeads(leadsData);
    } catch (err) {
      logger.error('Error fetching leads', { error: err });
    } finally {
      setLeadsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchLeads();
    }
  }, [authLoading, isAuthenticated, fetchLeads]);

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

  const handleCompleteTask = useCallback(async (taskId?: string, taskTitle?: string) => {
    if (!taskId || !taskTitle) return;
    try {
      await completeTaskWithPolicy({ taskId });
      success(t('tasks.messages.completed', { title: taskTitle }));
      // Real-time subscription auto-updates — no manual refetch needed
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
        // Real-time subscription auto-updates — no manual refetch needed
      } catch {
        notifyError(t('tasks.messages.deleteError'));
      }
    }
  }, [t, confirm, success, notifyError]);

  const getLeadName = useCallback((leadId?: string) => leads.find(l => l.id === leadId)?.fullName || null, [leads]);

  // ADR-229 Phase 2: Centralized loading/error states
  if (loading) {
    return <PageLoadingState icon={Clock} message={t('tasks.loading', { defaultValue: 'Φόρτωση εργασιών...' })} layout="contained" />;
  }

  if (error) {
    return <PageErrorState title={t('tasks.errorTitle', { defaultValue: 'Σφάλμα φόρτωσης' })} message={error} layout="contained" />;
  }

  return (
    <section className={sp.spaceBetween.md}>
      <ConfirmDialog {...dialogProps} />
      {/* Task List — filters handled by AdvancedFiltersPanel at page level */}
      {filteredTasks.length === 0 ? (
        <div className={`text-center ${sp.padding.y['2xl']}`}><p className={colors.text.muted}>{t('tasks.noTasks')}</p></div>
      ) : (
        filteredTasks.map((task) => {
          const TaskIcon = TASK_TYPE_ICONS[task.type] || Clock;
          const leadName = getLeadName(task.leadId);
          const meta = (task.metadata || {}) as TaskMetadata;
          return (
            <article key={task.id} className={`${colors.bg.primary} ${sp.padding.md} rounded-lg border ${HOVER_SHADOWS.SUBTLE}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className={`flex items-center ${sp.gap.sm} ${sp.margin.bottom.sm}`}>
                    <div className={`${iconSizes.xl} rounded-full flex items-center justify-center ${task.status === 'completed' ? colors.bg.successSubtle : colors.bg.infoSubtle}`}>
                      <TaskIcon className={`${iconSizes.sm} ${task.status === 'completed' ? colors.text.success : colors.text.info}`} />
                    </div>
                    <h4 className={`font-medium ${task.status === 'completed' ? `line-through ${colors.text.muted}` : colors.text.primary}`}>{task.title}</h4>
                    <Badge variant={PRIORITY_BADGE_VARIANT[task.priority]}>{task.priority}</Badge>
                    <Badge variant={STATUS_BADGE_VARIANT[task.status]}>{task.status}</Badge>
                  </div>
                  <div className={`${sp.spaceBetween.xs} ${typography.body.sm} ${colors.text.muted}`}>
                    <div className={`flex items-center ${sp.gap.md}`}>
                      <span className={`flex items-center gap-1 ${getDateColor(task.dueDate ?? undefined, task.status, colors)}`}><Clock className={iconSizes.xs} />{formatDueDate(task.dueDate ?? undefined)}</span>
                      {leadName && <span className="flex items-center gap-1"><User className={iconSizes.xs} />{leadName}</span>}
                      {meta.location && <span className="flex items-center gap-1"><MapPin className={iconSizes.xs} />{meta.location}</span>}
                    </div>
                    {task.description && <div className={`${colors.text.primary} ${sp.margin.top.sm}`}><SafeHTMLContent html={task.description} /></div>}
                  </div>
                </div>
                <div className={`flex items-center ${sp.gap.sm} ${sp.margin.left.md}`}>
                  {task.status !== 'completed' && <Button size="sm" variant="ghost" className={colors.text.success} onClick={() => handleCompleteTask(task.id, task.title)} aria-label={t('tasks.actions.complete')}><CheckCircle className={`${iconSizes.sm} ${sp.margin.right.xs}`} />{t('tasks.actions.complete')}</Button>}
                  <Button size="sm" variant="ghost" onClick={() => setEditingTask(task)} aria-label={t('tasks.actions.edit')}><Edit3 className={`${iconSizes.sm} ${sp.margin.right.xs}`} />{t('tasks.actions.edit')}</Button>
                  <Button size="sm" variant="ghost" className={colors.text.error} onClick={() => handleDeleteTask(task.id, task.title)} aria-label={t('tasks.actions.delete')}><Trash2 className={`${iconSizes.sm} ${sp.margin.right.xs}`} />{t('tasks.actions.delete')}</Button>
                </div>
              </div>
            </article>
          );
        })
      )}
      <CreateTaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onTaskCreated={() => { onTaskCreated?.(); }} />
      {editingTask && (
        <TaskEditDialog
          task={editingTask}
          open={!!editingTask}
          onOpenChange={(open) => { if (!open) setEditingTask(null); }}
          onUpdated={() => { setEditingTask(null); }}
        />
      )}
    </section>
  );
}
