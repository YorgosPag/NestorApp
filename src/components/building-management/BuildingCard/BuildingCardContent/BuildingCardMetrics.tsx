'use client';

import React from 'react';
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Building } from '../../BuildingsPageContent';
import { formatCurrency } from '@/lib/intl-utils';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface BuildingCardMetricsProps {
  building: Building;
}

export function BuildingCardMetrics({ building }: BuildingCardMetricsProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  // 🏢 ENTERPRISE: Centralized systems
  const typography = useTypography();
  const colors = useSemanticColors();

  return (
    <div className="grid grid-cols-2 gap-2 pt-2">
      <div className="space-y-1">
        <p className={typography.special.tertiary}>{t('card.metrics.area')}</p>
        <p className={typography.heading.sm}>{(building.totalArea ?? 0).toLocaleString('el-GR')} m²</p>
      </div>
      <div className="space-y-1">
        <p className={typography.special.tertiary}>{t('card.metrics.floors')}</p>
        <p className={typography.heading.sm}>{building.floors ?? 0}</p>
      </div>
      <div className="space-y-1">
        <p className={typography.special.tertiary}>{t('card.metrics.units')}</p>
        <p className={typography.heading.sm}>{building.units ?? 0}</p>
      </div>
      <div className="space-y-1">
        <p className={typography.special.tertiary}>{t('card.metrics.value')}</p>
        <Tooltip>
          <TooltipTrigger>
            <p className={`${typography.heading.sm} ${colors.text.price}`}>
              {formatCurrency(building.totalValue || 0)}
            </p>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('card.metrics.totalValueTooltip')}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
