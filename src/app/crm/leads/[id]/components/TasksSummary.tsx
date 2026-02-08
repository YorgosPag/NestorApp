'use client';

import React, { useMemo } from 'react';
import { Clock, CheckCircle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
import type { CrmTask } from '@/types/crm';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/design-system';

interface TasksSummaryProps {
  tasks: CrmTask[];
  loading: boolean;
}

export function TasksSummary({ tasks, loading }: TasksSummaryProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();
  const { t } = useTranslation('crm');
  const spacing = useSpacingTokens();

  const { pendingTasks, completedTasks } = useMemo(() => {
    if (!tasks) return { pendingTasks: [], completedTasks: [] };
    return {
      pendingTasks: tasks.filter(task => task.status === 'pending' || task.status === 'in_progress'),
      completedTasks: tasks.filter(task => task.status === 'completed'),
    };
  }, [tasks]);

  return (
    <div className={cn(colors.bg.primary, quick.card, 'shadow', spacing.padding.lg)}>
      <h4 className={cn('font-medium', spacing.margin.bottom.sm)}>{t('leadDetails.tasks.title')}</h4>
      {loading ? (
        <div className={cn('text-center', spacing.padding.y.md)}>
          <AnimatedSpinner size="large" className="mx-auto" />
        </div>
      ) : (
        <div className={spacing.spaceBetween.sm}>
          <div className="flex items-center justify-between text-sm">
            <span className={cn('flex items-center', spacing.gap.sm)}>
              <Clock className={cn(iconSizes.sm, colors.text.warning)} />
              {t('leadDetails.tasks.pending')}
            </span>
            <span className="font-medium">{pendingTasks.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className={cn('flex items-center', spacing.gap.sm)}>
              <CheckCircle className={cn(iconSizes.sm, colors.text.success)} />
              {t('leadDetails.tasks.completed')}
            </span>
            <span className="font-medium">{completedTasks.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}
