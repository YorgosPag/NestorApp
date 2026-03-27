'use client';

import React from 'react';
import { Calendar } from "lucide-react";
import { cn } from '@/lib/utils';
import type { Project } from '@/types/project';
import { formatDate } from '@/lib/intl-utils';
import { getDaysUntilCompletion } from '@/lib/project-utils';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getStatusColor } from '@/lib/design-system';

interface ProjectCardTimelineProps {
  project: Project;
}

export function ProjectCardTimeline({ project }: ProjectCardTimelineProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const daysUntilCompletion = getDaysUntilCompletion(project.completionDate);

  if (!project.completionDate) return null;

  return (
    <div className="px-2 pb-2 pt-2 border-t border-border/50">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Calendar className={iconSizes.xs} />
          <span>{t('timeline.deliveryLabel')}</span>
        </div>
        <div className="text-right">
          <p className="font-medium">{formatDate(project.completionDate)}</p>
          {daysUntilCompletion !== null && (
            <p className={cn(
              "text-xs",
              daysUntilCompletion < 0 ? getStatusColor('error', 'text') :
              daysUntilCompletion < 30 ? getStatusColor('construction', 'text') : getStatusColor('active', 'text')
            )}>
              {daysUntilCompletion < 0
                ? t('timeline.daysDelayed', { days: Math.abs(daysUntilCompletion) })
                : daysUntilCompletion === 0
                ? t('timeline.deliveryToday')
                : t('timeline.daysRemaining', { days: daysUntilCompletion })
              }
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
