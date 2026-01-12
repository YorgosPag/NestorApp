'use client';

import React from 'react';
import { Calendar } from "lucide-react";
import { cn } from '@/lib/utils';
import type { Building } from '../BuildingsPageContent';
import { formatDate } from '@/lib/intl-utils';
import { getDaysUntilCompletion } from './BuildingCardUtils';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';


interface BuildingCardTimelineProps {
  building: Building;
}

export function BuildingCardTimeline({ building }: BuildingCardTimelineProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  const daysUntilCompletion = getDaysUntilCompletion(building.completionDate);

  if (!building.completionDate) return null;

  return (
    <div className="px-6 pb-6 pt-2 border-t border-border/50">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Calendar className={iconSizes.xs} />
          <span>{t('card.timeline.delivery')}</span>
        </div>
        <div className="text-right">
          <p className="font-medium">{formatDate(building.completionDate)}</p>
          {daysUntilCompletion !== null && (
            <p className={cn(
              "text-xs",
              daysUntilCompletion < 0 ? "text-red-500" :
              daysUntilCompletion < 30 ? "text-yellow-600" : "text-green-600"
            )}>
              {daysUntilCompletion < 0
                ? t('card.timeline.daysDelay', { days: Math.abs(daysUntilCompletion) })
                : daysUntilCompletion === 0
                ? t('card.timeline.deliveryToday')
                : t('card.timeline.daysRemaining', { days: daysUntilCompletion })
              }
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
