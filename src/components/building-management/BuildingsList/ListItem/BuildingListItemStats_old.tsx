'use client';

import React from 'react';
import { formatCurrency } from '@/lib/intl-utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Building } from '../../BuildingsPageContent';
import '@/lib/design-system';

interface BuildingListItemStatsProps {
  building: Building;
}

export function BuildingListItemStats({ building }: BuildingListItemStatsProps) {
  const { t } = useTranslation('building');
  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      <div>
        <p className="text-muted-foreground">{t('listItem.stats.area')}</p>
        <p className="font-medium">{building.totalArea.toLocaleString('el-GR')} m²</p>
      </div>
      <div>
        <p className="text-muted-foreground">{t('listItem.stats.floors')}</p>
        <p className="font-medium">{building.floors}</p>
      </div>
      <div>
        <p className="text-muted-foreground">{t('listItem.stats.units')}</p>
        <p className="font-medium">{building.units}</p>
      </div>
      <div>
        <p className="text-muted-foreground">{t('listItem.stats.value')}</p>
        <p className="font-medium">{formatCurrency((building.totalValue ?? 0))}</p>
      </div>
    </div>
  );
}
