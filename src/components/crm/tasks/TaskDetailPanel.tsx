'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Clock, CheckCircle, Edit3, Trash2,
  Calendar, User, MapPin,
} from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { EntityDetailsHeader } from '@/core/entity-headers';
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
}

export function TaskDetailPanel({ activity, leads = [], onActionCompleted }: TaskDetailPanelProps) {
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

  if (!activity) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
        <div className="rounded-full bg-muted p-4">
          <Clock className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <p className={`font-medium ${colors.text.primary}`}>{t('tasks.panel.selectTask')}</p>
          <p className={`text-sm mt-1 ${colors.text.muted}`}>{t('tasks.panel.selectTaskDesc')}</p>
        </div>
      </div>
    );
  }

  if (activity.kind === 'appointment') {
    const { appt, title, date } = activity;
    const dateLabel = date
      ? format(date, 'dd/MM/yyyy HH:mm', { locale: el })
      : t('tasks.noDate');
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <EntityDetailsHeader
          icon={Calendar}
          title={title}
          subtitle={dateLabel}
          badges={[{ type: 'status', value: appt.status }]}
          variant="default"
        />
        <div className={`flex-1 overflow-y-auto ${sp.padding.md} space-y-3`}>
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
      </div>
    );
  }

  const { task } = activity;
  const TaskIcon = TASK_TYPE_ICONS[task.type] ?? Clock;
  const leadName = getLeadName(task.leadId);
  const meta = (task.metadata ?? {}) as Record<string, unknown>;
  const dueDate = task.dueDate ? new Date(task.dueDate as string) : null;
  const dueDateLabel = dueDate
    ? format(dueDate, 'dd/MM/yyyy HH:mm', { locale: el })
    : t('tasks.noDate');
  const isCompleted = task.status === 'completed';

  const headerActions = [
    ...(!isCompleted ? [{
      label: t('tasks.actions.complete'),
      icon: CheckCircle,
      onClick: () => handleComplete(task),
      variant: 'ghost' as const,
      className: colors.text.success,
    }] : []),
    {
      label: t('tasks.actions.edit'),
      icon: Edit3,
      onClick: () => setEditingTask(task),
      variant: 'ghost' as const,
    },
    {
      label: t('tasks.actions.delete'),
      icon: Trash2,
      onClick: () => handleDelete(task),
      variant: 'ghost' as const,
      className: colors.text.error,
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ConfirmDialog {...dialogProps} />
      <EntityDetailsHeader
        icon={TaskIcon}
        title={task.title}
        subtitle={dueDateLabel}
        badges={[
          { type: 'status', value: priorityLabels[task.priority] ?? task.priority },
          { type: 'progress', value: statusLabels[task.status] ?? task.status },
        ]}
        actions={headerActions}
        variant="default"
      />
      <div className={`flex-1 overflow-y-auto ${sp.padding.md} space-y-4`}>
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

        {meta.location && typeof meta.location === 'string' && (
          <div className={`flex items-center gap-2 text-sm ${colors.text.muted}`}>
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span>{meta.location}</span>
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

      {editingTask && (
        <TaskEditDialog
          task={editingTask}
          open={!!editingTask}
          onOpenChange={(open) => { if (!open) setEditingTask(null); }}
          onUpdated={() => { setEditingTask(null); onActionCompleted?.(); }}
        />
      )}
    </div>
  );
}

export default TaskDetailPanel;
