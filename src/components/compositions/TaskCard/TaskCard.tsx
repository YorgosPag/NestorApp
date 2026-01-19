'use client';

import React, { useState } from 'react';
import { BaseCard } from '@/components/core/BaseCard/BaseCard';
import { CommonBadge } from '@/core/badges';
import { HOVER_SHADOWS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { formatDate } from '@/lib/intl-utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { getStatusBadgeClass } from '@/lib/design-system';
import { badgeVariants } from '@/components/ui/badge';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { 
  Clock, 
  Calendar, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Eye, 
  FileText, 
  MessageSquare, 
  Video,
  CheckCircle,
  Edit,
  Trash2,
  AlertCircle
} from 'lucide-react';
import type { CrmTask } from '@/types/crm';

interface TaskCardProps {
  task: CrmTask;
  onComplete?: (taskId: string) => void;
  onEdit?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onView?: (taskId: string) => void;
  isSelected?: boolean;
  onSelectionChange?: () => void;
  showAssignee?: boolean;
  compact?: boolean;
}

const getTaskTypeIcon = (type: string) => {
  const typeIcons: Record<string, React.ElementType> = {
    'call': Phone,
    'email': Mail,
    'meeting': Video,
    'viewing': Eye,
    'document': FileText,
    'follow_up': MessageSquare,
    'other': AlertCircle
  };
  return typeIcons[type] || AlertCircle;
};

// 🏢 ENTERPRISE: Badge variant type for priority colors
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'error' | 'purple' | 'light' | 'muted' | 'subtle';

const getPriorityColor = (priority: string): BadgeVariant => {
  switch (priority) {
    case 'urgent': return 'error';
    case 'high': return 'warning';
    case 'medium': return 'info';
    case 'low': return 'secondary';
    default: return 'secondary';
  }
};

/** Date value that could be string, Date, or Firestore Timestamp */
type TaskDateValue = string | Date | { toDate: () => Date } | null | undefined;

const isOverdue = (dueDate: TaskDateValue, status: string) => {
  if (!dueDate || status === 'completed' || status === 'cancelled') return false;
  const due = typeof dueDate === 'string'
    ? new Date(dueDate)
    : (dueDate && typeof dueDate === 'object' && 'toDate' in dueDate)
      ? dueDate.toDate()
      : dueDate as Date;
  return due < new Date();
};

export function TaskCard({
  task,
  onComplete,
  onEdit,
  onDelete,
  onView,
  isSelected = false,
  onSelectionChange,
  showAssignee = true,
  compact = false
}: TaskCardProps) {
  const iconSizes = useIconSizes();
  const [isFavorite, setIsFavorite] = useState(false);
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('tasks');

  // 🏢 ENTERPRISE: Localized label functions
  const getTaskTypeLabel = (type: string): string => {
    return t(`types.${type}`, { defaultValue: t('types.other') });
  };

  const getTaskStatusLabel = (status: string): string => {
    return t(`status.${status}`, { defaultValue: status });
  };

  const getPriorityLabel = (priority: string): string => {
    return t(`priority.${priority}`, { defaultValue: priority });
  };

  // 🏢 ENTERPRISE: Localized date formatting
  const formatLocalizedTaskDate = (date: TaskDateValue): string => {
    if (!date) return t('card.notDefined');
    const taskDate = typeof date === 'string'
      ? new Date(date)
      : (date && typeof date === 'object' && 'toDate' in date)
        ? date.toDate()
        : date as Date;
    return formatDate(taskDate);
  };

  const TaskTypeIcon = getTaskTypeIcon(task.type);
  const overdue = isOverdue(task.dueDate, task.status);

  return (
    <BaseCard
      // Βασικές ιδιότητες
      title={task.title}
      subtitle={task.description}
      
      // Header configuration
      headerConfig={{
        backgroundGradient: task.status === 'completed' 
          ? "from-green-100 via-emerald-50 to-teal-100 dark:from-green-950 dark:via-emerald-950 dark:to-teal-900"
          : overdue
          ? "from-red-100 via-pink-50 to-red-100 dark:from-red-950 dark:via-pink-950 dark:to-red-900"  
          : "from-blue-100 via-indigo-50 to-purple-100 dark:from-blue-950 dark:via-indigo-950 dark:to-purple-900",
        logo: <TaskTypeIcon className={`${iconSizes.xl} ${
          task.status === 'completed' ? 'text-green-600 dark:text-green-400' :
          overdue ? 'text-red-600 dark:text-red-400' :
          'text-blue-600 dark:text-blue-400'
        }`} />,
        compact
      }}
      
      // Selection state
      isSelected={isSelected}
      onSelectionChange={onSelectionChange}
      
      // Favorites
      isFavorite={isFavorite}
      onFavoriteChange={setIsFavorite}
      
      // Status badges
      statusBadges={[
        {
          label: getTaskStatusLabel(task.status),
          className: getStatusBadgeClass(task.status === 'completed' ? 'completed' : 
                                        task.status === 'cancelled' ? 'cancelled' :
                                        overdue ? 'error' : 'active')
        },
        {
          label: getTaskTypeLabel(task.type),
          className: badgeVariants({ variant: 'outline', size: 'sm' })
        },
        {
          label: `${getPriorityLabel(task.priority)} ${t('card.prioritySuffix')}`,
          className: badgeVariants({
            variant: getPriorityColor(task.priority),
            size: 'sm'
          })
        }
      ]}
      
      // Content sections
      contentSections={[
        // Due date section
        task.dueDate && {
          title: t('card.sections.dueDate'),
          content: (
            <div className={`flex items-center gap-2 text-sm ${
              overdue ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
            }`}>
              <Calendar className={iconSizes.sm} />
              <span>{formatLocalizedTaskDate(task.dueDate)}</span>
              {overdue && <span className="text-xs font-medium">({t('time.overdue')})</span>}
            </div>
          )
        },
        
        // Assignee section
        showAssignee && task.assignedTo && {
          title: t('card.sections.assignedTo'),
          content: (
            <div className="flex items-center gap-2 text-sm">
              <User className={`${iconSizes.sm} text-muted-foreground`} />
              <span>{task.assignedTo}</span>
            </div>
          )
        },
        
        // Related entities
        (task.contactId || task.projectId || task.unitId) && {
          title: t('card.sections.related'),
          content: (
            <div className="space-y-1 text-sm">
              {task.contactId && (
                <div className="flex items-center gap-2">
                  <User className={`${iconSizes.xs} text-muted-foreground`} />
                  <span className="text-xs">Contact: {task.contactId}</span>
                </div>
              )}
              {task.projectId && (
                <div className="flex items-center gap-2">
                  <FileText className={`${iconSizes.xs} text-muted-foreground`} />
                  <span className="text-xs">Project: {task.projectId}</span>
                </div>
              )}
              {task.unitId && (
                <div className="flex items-center gap-2">
                  <MapPin className={`${iconSizes.xs} text-muted-foreground`} />
                  <span className="text-xs">Unit: {task.unitId}</span>
                </div>
              )}
            </div>
          )
        },
        
        // Viewing details (for viewing tasks)
        task.type === 'viewing' && task.viewingDetails && {
          title: t('card.sections.viewingDetails'),
          content: (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className={`${iconSizes.sm} text-muted-foreground`} />
                <span>{task.viewingDetails.location}</span>
              </div>
              {task.viewingDetails.units.length > 0 && (
                <div>
                  <span className="text-muted-foreground">{t('card.viewing.units')}: </span>
                  <span>{task.viewingDetails.units.join(', ')}</span>
                </div>
              )}
              {task.viewingDetails.attendees.length > 0 && (
                <div>
                  <span className="text-muted-foreground">{t('card.viewing.attendees')}: </span>
                  <span>{task.viewingDetails.attendees.length}</span>
                </div>
              )}
            </div>
          )
        },
        
        // Completion info
        task.status === 'completed' && task.completedAt && {
          title: t('card.sections.completed'),
          content: (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className={iconSizes.sm} />
              <span>{formatLocalizedTaskDate(task.completedAt)}</span>
            </div>
          )
        }
      ].filter(Boolean)}
      
      // Actions
      actions={[
        task.status !== 'completed' && onComplete && {
          label: t('card.actions.complete'),
          icon: CheckCircle,
          onClick: () => onComplete(task.id!),
          variant: 'default' as const
        },
        onView && {
          label: t('card.actions.view'),
          icon: Eye,
          onClick: () => onView(task.id!),
          variant: 'outline' as const
        },
        onEdit && {
          label: t('card.actions.edit'),
          icon: Edit,
          onClick: () => onEdit(task.id!),
          variant: 'ghost' as const
        },
        onDelete && {
          label: t('card.actions.delete'),
          icon: Trash2,
          onClick: () => onDelete(task.id!),
          variant: 'ghost' as const
        }
      ].filter(Boolean)}
      
      // Style overrides
      className={`${TRANSITION_PRESETS.SMOOTH_ALL} ${HOVER_SHADOWS.ENHANCED} ${
        overdue && task.status !== 'completed' ? 'ring-1 ring-red-200 dark:ring-red-800' : ''
      } ${compact ? 'p-4' : ''}`}
    />
  );
}