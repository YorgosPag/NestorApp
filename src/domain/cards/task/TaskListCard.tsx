'use client';

/**
 * 🏢 ENTERPRISE: Task List Card — Domain wrapper around ListCard.
 * Follows ContactListCard pattern. SSoT for task/appointment card UI.
 */

import React from 'react';
import { Clock, User, MapPin, Calendar, CheckCircle, Edit3, Trash2, type LucideIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ListCard } from '@/design-system/components/ListCard/ListCard';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import {
  TASK_TYPE_ICONS,
  PRIORITY_BADGE_VARIANT,
  STATUS_BADGE_VARIANT,
} from '@/components/crm/tasks/task-activity';
import type { ActivityItem } from '@/components/crm/tasks/task-activity';
import type { CrmTask } from '@/types/crm';
import type { ListCardAction } from '@/design-system/components/ListCard/ListCard.types';

export interface TaskListCardProps {
  item: ActivityItem;
  isSelected?: boolean;
  onSelect?: () => void;
  getLeadName?: (leadId?: string) => string | null;
  onComplete?: (task: CrmTask) => void;
  onEdit?: (task: CrmTask) => void;
  onDelete?: (task: CrmTask) => void;
}

export function TaskListCard({
  item,
  isSelected,
  onSelect,
  getLeadName,
  onComplete,
  onEdit,
  onDelete,
}: TaskListCardProps) {
  const { t } = useTranslation(['crm']);
  const colors = useSemanticColors();

  if (item.kind === 'appointment') {
    const { appt, title, date } = item;
    const dateLabel = date ? format(date, 'dd/MM/yyyy HH:mm') : t('tasks.noDate');
    return (
      <ListCard
        customIcon={Calendar}
        customIconColor={colors.text.info}
        title={title}
        subtitle={dateLabel}
        badges={[{ label: appt.status, variant: 'info' }]}
        isSelected={isSelected}
        onClick={onSelect}
        aria-label={title}
      />
    );
  }

  const { task } = item;
  const TaskIcon = (TASK_TYPE_ICONS[task.type] ?? Clock) as LucideIcon;
  const leadName = getLeadName?.(task.leadId) ?? null;
  const meta = (task.metadata ?? {}) as Record<string, unknown>;
  const location = typeof meta.location === 'string' ? meta.location : null;
  const dueDate = task.dueDate ? new Date(task.dueDate as string) : null;
  const dueDateLabel = dueDate ? format(dueDate, 'dd/MM/yyyy HH:mm') : t('tasks.noDate');

  const stats = [
    { icon: Clock, label: t('tasks.panel.dueDate'), value: dueDateLabel },
    ...(leadName ? [{ icon: User, label: 'Lead', value: leadName }] : []),
    ...(location ? [{ icon: MapPin, label: 'Location', value: location }] : []),
  ];

  const actions: ListCardAction[] = [
    ...(task.status !== 'completed' && onComplete ? [{
      id: 'complete',
      label: t('tasks.actions.complete'),
      icon: CheckCircle,
      onClick: (_e: React.MouseEvent) => onComplete(task),
      className: colors.text.success,
    }] : []),
    ...(onEdit ? [{
      id: 'edit',
      label: t('tasks.actions.edit'),
      icon: Edit3,
      onClick: (_e: React.MouseEvent) => onEdit(task),
    }] : []),
    ...(onDelete ? [{
      id: 'delete',
      label: t('tasks.actions.delete'),
      icon: Trash2,
      onClick: (_e: React.MouseEvent) => onDelete(task),
      className: colors.text.error,
    }] : []),
  ];

  return (
    <ListCard
      customIcon={TaskIcon}
      customIconColor={task.status === 'completed' ? colors.text.success : colors.text.info}
      title={task.title}
      badges={[
        { label: t(`tasks.priority.${task.priority}`), variant: PRIORITY_BADGE_VARIANT[task.priority] },
        { label: t(`tasks.status.${task.status}`), variant: STATUS_BADGE_VARIANT[task.status] },
      ]}
      stats={stats}
      actions={actions}
      isSelected={isSelected}
      onClick={onSelect}
      aria-label={task.title}
    />
  );
}

export default TaskListCard;
