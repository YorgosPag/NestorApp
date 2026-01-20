// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from 'react-i18next';

export function QuickStats({
  availableLabel,
  availableValue,
  pricesFromLabel,
  pricesFromValue,
}: {
  availableLabel: string;
  availableValue: string;
  pricesFromLabel: string;
  pricesFromValue: string;
}) {
  const { t } = useTranslation('properties');
  const colors = useSemanticColors();
  return (
    <div className="px-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">{t('public.quickStats')}</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{availableLabel}</span>
          <span className={`font-medium ${colors.text.success}`}>{availableValue}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{pricesFromLabel}</span>
          <span className="font-medium">{pricesFromValue}</span>
        </div>
      </div>
    </div>
  );
}
