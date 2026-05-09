'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Clock,
  Calendar, User, MapPin, type LucideIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import { DetailsContainer } from '@/core/containers';
import { Badge } from '@/components/ui/badge';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SafeHTMLContent } from '@/components/shared/email/EmailContentRenderer';
import { TaskEditDialog } from '@/components/crm/dashboard/dialogs/TaskEditDialog';
import { completeTaskWithPolicy, deleteTaskWithPolicy } from '@/services/crm/crm-mutation-gateway';
import {
  TASK_TYPE_ICONS,
  PRIORITY_BADGE_VARIANT,
  STATUS_BADGE_VARIANT,
  type ActivityItem,
} from '@/components/crm/dashboard/TasksTab';
import type { Opportunity, CrmTask } from '@/types/crm';

interface TaskDetailPanelProps {
  activity: ActivityItem | null;
  leads?: Opportunity[];
  onActionCompleted?: () => void;
  onCreateTask?: () => void;
}

export function TaskDetailPanel({ activity, leads = [], onActionCompleted, onCreateTask }: TaskDetailPanelProps) {
  const { t } = useTranslation(['crm']);
  const colors = useSemanticColors();
  const sp = useSpacingTokens();
  const { success, error: notifyError } = useNotifications();
  const { confirm, dialogProps } = useConfirmDialog();
  const [editingTask, setEditingTask] = useState<CrmTask | null>(null);

  const priorityLabels = useMemo<Partial<Record<string, string>>>(() => ({
    low: t('tasks.priority.low'),
    medium: t('tasks.priority.medium'),
    high: t('tasks.priority.high'),
    urgent: t('tasks.priority.urgent'),
  }), [t]);

  const statusLabels = useMemo<Partial<Record<string, string>>>(() => ({
    pending: t('tasks.status.pending'),
    in_progress: t('tasks.status.in_progress'),
    completed: t('tasks.status.completed'),
    cancelled: t('tasks.status.cancelled'),
  }), [t]);

  const typeLabels = useMemo<Partial<Record<string, string>>>(() => ({
    call: t('tasks.type.call'),
    meeting: t('tasks.type.meeting'),
    viewing: t('tasks.type.viewing'),
    follow_up: t('tasks.type.follow_up'),
    email: t('tasks.type.email'),
    document: t('tasks.type.document'),
    other: t('tasks.type.other'),
  }), [t]);

  const getLeadName = useCallback(
    (leadId?: string) => leads.find(l => l.id === leadId)?.fullName ?? null,
    [leads]
  );

  const handleComplete = useCallback(async (task: CrmTask) => {
    try {
      await completeTaskWithPolicy({ taskId: task.id! });
      success(t('tasks.messages.completed', { title: task.title }));
      onActionCompleted?.();
    } catch {
      notifyError(t('tasks.messages.completeError'));
    }
  }, [t, success, notifyError, onActionCompleted]);

  const handleDelete = useCallback(async (task: CrmTask) => {
    const confirmed = await confirm({
      title: t('tasks.messages.deleteConfirm', { title: task.title }),
      description: t('tasks.messages.deleteConfirm', { title: task.title }),
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await deleteTaskWithPolicy({ taskId: task.id! });
      success(t('tasks.messages.deleted', { title: task.title }));
      onActionCompleted?.();
    } catch {
      notifyError(t('tasks.messages.deleteError'));
    }
  }, [t, confirm, success, notifyError, onActionCompleted]);

  // Derive header and body for DetailsContainer
  let headerEl: React.ReactNode = undefined;
  let bodyEl: React.ReactNode = undefined;

  if (activity?.kind === 'appointment') {
    const { appt, title, date } = activity;
    const dateLabel = date
      ? format(date, 'dd/MM/yyyy HH:mm', { locale: el })
      : t('tasks.noDate');
    headerEl = (
      <EntityDetailsHeader
        icon={Calendar}
        title={title}
        variant="detailed"
      />
    );
    bodyEl = (
      <div className={`${sp.padding.md} space-y-3`}>
        <div className={`flex items-center gap-2 text-sm ${colors.text.muted}`}>
          <Clock className="h-4 w-4 flex-shrink-0" />
          <span className={colors.text.info}>{dateLabel}</span>
        </div>
        {appt.requester?.name && (
          <div className={`flex items-center gap-2 text-sm ${colors.text.muted}`}>
            <User className="h-4 w-4 flex-shrink-0" />
            <span>{appt.requester.name}</span>
          </div>
        )}
      </div>
    );
  } else if (activity?.kind === 'task') {
    const { task } = activity;
    const TaskIcon = (TASK_TYPE_ICONS[task.type] ?? Clock) as LucideIcon;
    const leadName = getLeadName(task.leadId);
    const meta = (task.metadata ?? {}) as Record<string, unknown>;
    const location = typeof meta.location === 'string' ? meta.location : null;
    const dueDate = task.dueDate ? new Date(task.dueDate as string) : null;
    const dueDateLabel = dueDate
      ? format(dueDate, 'dd/MM/yyyy HH:mm', { locale: el })
      : t('tasks.noDate');
    const isCompleted = task.status === 'completed';

    const headerActions = [
      ...(!isCompleted ? [createEntityAction('complete', t('tasks.actions.complete'), () => handleComplete(task))] : []),
      createEntityAction('edit', t('tasks.actions.edit'), () => setEditingTask(task)),
      createEntityAction('delete', t('tasks.actions.delete'), () => handleDelete(task)),
    ];

    headerEl = (
      <EntityDetailsHeader
        icon={TaskIcon}
        title={task.title}
        actions={headerActions}
        variant="detailed"
      />
    );
    bodyEl = (
      <div className={`${sp.padding.md} space-y-4`}>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className={`text-xs font-medium uppercase tracking-wide ${colors.text.muted} mb-1`}>{t('tasks.panel.dueDate')}</dt>
            <dd className={`font-medium ${isCompleted ? colors.text.success : colors.text.primary}`}>{dueDateLabel}</dd>
          </div>
          <div>
            <dt className={`text-xs font-medium uppercase tracking-wide ${colors.text.muted} mb-1`}>{t('tasks.priority.label')}</dt>
            <dd><Badge variant={PRIORITY_BADGE_VARIANT[task.priority]}>{priorityLabels[task.priority] ?? task.priority}</Badge></dd>
          </div>
          <div>
            <dt className={`text-xs font-medium uppercase tracking-wide ${colors.text.muted} mb-1`}>{t('tasks.status.label')}</dt>
            <dd><Badge variant={STATUS_BADGE_VARIANT[task.status]}>{statusLabels[task.status] ?? task.status}</Badge></dd>
          </div>
          <div>
            <dt className={`text-xs font-medium uppercase tracking-wide ${colors.text.muted} mb-1`}>{t('tasks.type.label')}</dt>
            <dd className={colors.text.primary}>{typeLabels[task.type] ?? task.type}</dd>
          </div>
        </dl>

        {leadName && (
          <div className={`flex items-center gap-2 text-sm ${colors.text.muted}`}>
            <User className="h-4 w-4 flex-shrink-0" />
            <span>{leadName}</span>
          </div>
        )}

        {location && (
          <div className={`flex items-center gap-2 text-sm ${colors.text.muted}`}>
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span>{location}</span>
          </div>
        )}

        {task.description && (
          <div>
            <p className={`text-xs font-medium uppercase tracking-wide ${colors.text.muted} mb-2`}>{t('tasks.panel.description')}</p>
            <div className={`text-sm ${colors.text.primary}`}>
              <SafeHTMLContent html={task.description} />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <ConfirmDialog {...dialogProps} />
      <DetailsContainer
        selectedItem={activity ? { id: 'activity' } : null}
        emptyStateProps={{
          icon: Clock,
          title: t('tasks.emptyState.title'),
          description: t('tasks.emptyState.description'),
        }}
        onCreateAction={onCreateTask}
        header={headerEl}
        tabsRenderer={bodyEl}
      />
      {editingTask && (
        <TaskEditDialog
          task={editingTask}
          open={!!editingTask}
          onOpenChange={(open) => { if (!open) setEditingTask(null); }}
          onUpdated={() => { setEditingTask(null); onActionCompleted?.(); }}
        />
      )}
    </>
  );
}

export default TaskDetailPanel;
