'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Car,
  BarChart3,
  Package,
  Ruler
} from 'lucide-react';
import type { ParkingStats } from '@/types/parking';
import { formatCurrency } from '@/lib/intl-utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { UNIFIED_STATUS_FILTER_LABELS } from '@/constants/property-statuses-enterprise';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ParkingStatsSummaryProps {
    stats: ParkingStats;
}

export function ParkingStatsSummary({ stats }: ParkingStatsSummaryProps) {
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('projects');
    const iconSizes = useIconSizes();
    const { quick } = useBorderTokens();
    const colors = useSemanticColors();

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className={`flex items-center gap-2 p-3 bg-card ${quick.card}`}>
            <Car className={`${iconSizes.sm} ${colors.text.info}`} />
            <div>
              <div className="text-sm font-medium">{stats.totalSpots}</div>
              <div className="text-xs text-muted-foreground">{t('parking.stats.total')}</div>
            </div>
          </div>

          <div className={`flex items-center gap-2 p-3 bg-card ${quick.card}`}>
            <div className={`${iconSizes.xs} rounded-full ${colors.bg.success}`} />
            <div>
              <div className="text-sm font-medium">{stats.soldSpots}</div>
              <div className="text-xs text-muted-foreground">{t('parking.stats.sold')}</div>
            </div>
          </div>

          <div className={`flex items-center gap-2 p-3 bg-card ${quick.card}`}>
            <div className={`${iconSizes.xs} rounded-full ${colors.bg.info}`} />
            <div>
              <div className="text-sm font-medium">{stats.ownerSpots}</div>
              <div className="text-xs text-muted-foreground">{t('parking.stats.landowner')}</div>
            </div>
          </div>

          <div className={`flex items-center gap-2 p-3 bg-card ${quick.card}`}>
            <div className={`${iconSizes.xs} rounded-full ${colors.bg.muted}`} />
            <div>
              <div className="text-sm font-medium">{stats.availableSpots}</div>
              <div className="text-xs text-muted-foreground">{UNIFIED_STATUS_FILTER_LABELS.AVAILABLE}</div>
            </div>
          </div>

          <div className={`flex items-center gap-2 p-3 bg-card ${quick.card}`}>
            <BarChart3 className={`${iconSizes.sm} ${colors.text.success}`} />
            <div>
              <div className="text-sm font-medium">{formatCurrency(stats.totalValue)}</div>
              <div className="text-xs text-muted-foreground">{t('parking.stats.totalValue')}</div>
            </div>
          </div>

          <div className={`flex items-center gap-2 p-3 bg-card ${quick.card}`}>
            <Ruler className={`${iconSizes.sm} ${colors.text.accent}`} />
            <div>
              <div className="text-sm font-medium">{stats.totalArea.toFixed(1)} m²</div>
              <div className="text-xs text-muted-foreground">{t('parking.stats.area')}</div>
            </div>
          </div>
        </div>
    );
}
