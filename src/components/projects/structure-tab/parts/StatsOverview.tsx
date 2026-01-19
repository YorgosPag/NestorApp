'use client';

import React from 'react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface StatsOverviewProps {
  totalUnits: number;
  soldUnits: number;
  totalArea: number;
  soldPct: number;
}

export function StatsOverview({ totalUnits, soldUnits, totalArea, soldPct }: StatsOverviewProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className={`${colors.bg.primary} p-4 ${quick.card}`}>
        <div className={`text-sm ${colors.text.muted}`}>{t('structure.totalUnitsLabel')}</div>
        <div className={`text-2xl font-bold ${colors.text.info}`}>{totalUnits}</div>
      </div>
      <div className={`${colors.bg.primary} p-4 ${quick.card}`}>
        <div className={`text-sm ${colors.text.muted}`}>{t('structure.soldLabel')}</div>
        <div className={`text-2xl font-bold ${colors.text.success}`}>{soldUnits}</div>
      </div>
      <div className={`${colors.bg.primary} p-4 ${quick.card}`}>
        <div className={`text-sm ${colors.text.muted}`}>{t('structure.totalArea')}</div>
        <div className={`text-2xl font-bold ${colors.text.accent}`}>{totalArea.toFixed(1)} m²</div>
      </div>
      <div className={`${colors.bg.primary} p-4 ${quick.card}`}>
        <div className={`text-sm ${colors.text.muted}`}>{t('structure.salesPctLabel')}</div>
        <div className="text-2xl font-bold text-orange-600">
          {soldPct.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}
