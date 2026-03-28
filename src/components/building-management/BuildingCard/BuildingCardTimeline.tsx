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
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';


interface BuildingCardTimelineProps {
  building: Building;
}

export function BuildingCardTimeline({ building }: BuildingCardTimelineProps) {
  // 🏢 ENTERPRISE: i18n hook for translations with namespace readiness check
  const { t, isNamespaceReady } = useTranslation('building');
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const daysUntilCompletion = getDaysUntilCompletion(building.completionDate);

  if (!building.completionDate) return null;

  return (
    <div className="px-2 pb-2 pt-2 border-t border-border/50">
      <div className="flex items-center justify-between text-xs">
        <div className={cn("flex items-center gap-1", colors.text.muted)}>
          <Calendar className={iconSizes.xs} />
          {/* 🏢 ENTERPRISE: Fallback when namespace not ready */}
          <span>{isNamespaceReady ? t('card.timeline.delivery') : 'Delivery:'}</span>
        </div>
        <div className="text-right">
          <p className="font-medium">{formatDate(building.completionDate)}</p>
          {daysUntilCompletion !== null && (
            <p className={cn(
              "text-xs",
              daysUntilCompletion < 0 ? "text-red-500" : // eslint-disable-line design-system/enforce-semantic-colors
              daysUntilCompletion < 30 ? "text-yellow-600" : "text-green-600" // eslint-disable-line design-system/enforce-semantic-colors
            )}>
              {/* 🏢 ENTERPRISE: Fallback to raw values when namespace not ready */}
              {daysUntilCompletion < 0
                ? (isNamespaceReady
                    ? t('card.timeline.daysDelay', { days: Math.abs(daysUntilCompletion) })
                    : `${Math.abs(daysUntilCompletion)} days delay`)
                : daysUntilCompletion === 0
                ? (isNamespaceReady ? t('card.timeline.deliveryToday') : 'Delivery today!')
                : (isNamespaceReady
                    ? t('card.timeline.daysRemaining', { days: daysUntilCompletion })
                    : `${daysUntilCompletion} days remaining`)
              }
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
