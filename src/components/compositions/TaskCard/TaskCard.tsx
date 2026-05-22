'use client';

import React, { useState } from 'react';
import { BaseCard } from '@/components/core/BaseCard/BaseCard';
import { HOVER_SHADOWS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { formatFlexibleDateTime } from '@/lib/intl-utils';
import { normalizeToDate } from '@/lib/date-local';
import { useIconSizes } from '@/hooks/useIconSizes';
import { getStatusBadgeClass } from '@/lib/design-system';
import { badgeVariants } from '@/components/ui/badge';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { 
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
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

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

const isOverdue = (dueDate: unknown, status: string) => {
  if (!dueDate || status === 'completed' || status === 'cancelled') return false;
  const due = normalizeToDate(dueDate);
  return due ? due < new Date() : false;
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
  const colors = useSemanticColors();
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

  // 🏢 ENTERPRISE: Localized date formatting (ADR-208 — centralized)
  const formatLocalizedTaskDate = (date: unknown): string => {
    if (!date) return t('card.notDefined');
    const result = formatFlexibleDateTime(date, { year: 'numeric', month: '2-digit', day: '2-digit' });
    return result === '-' ? t('card.notDefined') : result;
  };

  const TaskTypeIcon = getTaskTypeIcon(task.type);
  const overdue = isOverdue(task.dueDate, task.status);

  return (
    <BaseCard
      // Βασικές ιδιότητες
      title={task.title}
      subtitle={task.description ?? undefined}
      
      // Header configuration
      headerConfig={{
        backgroundGradient: task.status === 'completed'
          ? "from-[hsl(var(--bg-success))]/20 via-[hsl(var(--bg-success))]/10 to-accent"
          : overdue
          ? "from-destructive/10 via-destructive/5 to-destructive/10"
          : "from-[hsl(var(--bg-info))]/20 via-accent to-accent",
        logo: <TaskTypeIcon className={`${iconSizes.xl} ${
          task.status === 'completed' ? 'text-green-707' :
          overdue ? 'text-destructive' :
          'text-primary'
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
              overdue ? 'text-destructive' : colors.text.muted
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
              <User className={`${iconSizes.sm} ${colors.text.muted}`} />
              <span>{task.assignedTo}</span>
            </div>
          )
        },
        
        // Related entities
        (task.contactId || task.projectId || task.propertyId) && {
          title: t('card.sections.related'),
          content: (
            <div className="space-y-1 text-sm">
              {task.contactId && (
                <div className="flex items-center gap-2">
                  <User className={`${iconSizes.xs} ${colors.text.muted}`} />
                  <span className="text-xs">Contact: {task.contactId}</span>
                </div>
              )}
              {task.projectId && (
                <div className="flex items-center gap-2">
                  <FileText className={`${iconSizes.xs} ${colors.text.muted}`} />
                  <span className="text-xs">Project: {task.projectId}</span>
                </div>
              )}
              {task.propertyId && (
                <div className="flex items-center gap-2">
                  <MapPin className={`${iconSizes.xs} ${colors.text.muted}`} />
                  <span className="text-xs">Unit: {task.propertyId}</span>
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
                <MapPin className={`${iconSizes.sm} ${colors.text.muted}`} />
                <span>{task.viewingDetails.location}</span>
              </div>
              {task.viewingDetails.units.length > 0 && (
                <div>
                  <span className={colors.text.muted}>{t('card.viewing.units')}: </span>
                  <span>{task.viewingDetails.units.join(', ')}</span>
                </div>
              )}
              {task.viewingDetails.attendees.length > 0 && (
                <div>
                  <span className={colors.text.muted}>{t('card.viewing.attendees')}: </span>
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
            <div className="flex items-center gap-2 text-sm text-green-707">
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
        overdue && task.status !== 'completed' ? 'ring-1 ring-destructive/30' : ''
      } ${compact ? 'p-4' : ''}`}
    />
  );
}