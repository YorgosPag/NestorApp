'use client';

import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { CrmTask } from '@/types/crm';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { getTaskDateColor, formatTaskDate } from '../utils/dates';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/design-system';

interface UpcomingTasksProps {
  tasks: CrmTask[];
  router: AppRouterInstance;
}

export function UpcomingTasks({ tasks, router }: UpcomingTasksProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { quick, radiusClass } = useBorderTokens();
  const { t } = useTranslation('crm');
  const spacing = useSpacingTokens();

  const pendingTasks = useMemo(() => {
    return tasks
      .filter(task => task.status === 'pending' || task.status === 'in_progress')
      .sort((a, b) => new Date(a.dueDate as string).getTime() - new Date(b.dueDate as string).getTime());
  }, [tasks]);

  if (pendingTasks.length === 0) {
    return null;
  }

  return (
    <div className={cn(colors.bg.primary, quick.card, 'shadow', spacing.padding.lg)}>
      <h3 className={cn('text-lg font-semibold', spacing.margin.bottom.md, colors.text.foreground)}>
        {t('leadDetails.upcoming.title')}
      </h3>
      <div className={spacing.spaceBetween.md}>
        {pendingTasks.slice(0, 5).map((task) => (
          <div
            key={task.id}
            className={cn('flex items-center justify-between', spacing.padding.sm, colors.bg.secondary, radiusClass.lg)}
          >
            <div className="flex-1">
              <h5 className={cn('font-medium', colors.text.foreground)}>{task.title}</h5>
              <div className={cn('flex items-center text-sm', spacing.gap.lg, colors.text.muted, spacing.margin.top.xs)}>
                <span className={getTaskDateColor(task.dueDate, task.status)}>
                  <Clock className={cn(iconSizes.xs, 'inline', spacing.margin.right.xs)} />
                  {formatTaskDate(task.dueDate)}
                </span>
                <span
                  className={cn(
                    spacing.padding.x.sm,
                    spacing.padding.y.xs,
                    radiusClass.full,
                    'text-xs',
                    task.priority === 'urgent'
                      ? cn(`${colors.bg.error}/50`, colors.text.error)
                      : task.priority === 'high'
                      ? cn(`${colors.bg.warning}/50`, colors.text.warning)
                      : task.priority === 'medium'
                      ? cn(`${colors.bg.warning}/30`, colors.text.warning)
                      : cn(`${colors.bg.success}/50`, colors.text.success)
                  )}
                >
                  {task.priority === 'urgent'
                    ? t('tasks.priority.urgent')
                    : task.priority === 'high'
                    ? t('tasks.priority.high')
                    : task.priority === 'medium'
                    ? t('tasks.priority.medium')
                    : t('tasks.priority.low')}
                </span>
              </div>
            </div>
          </div>
        ))}
        {pendingTasks.length > 5 && (
          <div className="text-center">
            <button
              onClick={() => router.push('/crm/tasks')}
              className={cn(colors.text.info, INTERACTIVE_PATTERNS.PRIMARY_HOVER, 'text-sm')}
            >
              {t('leadDetails.upcoming.viewAll', { count: pendingTasks.length })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
