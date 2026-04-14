// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

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
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  const colors = useSemanticColors();
  return (
    <div className="px-6">
      <h3 className={cn("text-sm font-medium mb-3", colors.text.muted)}>{t('public.quickStats')}</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className={colors.text.muted}>{availableLabel}</span>
          <span className={`font-medium ${colors.text.success}`}>{availableValue}</span>
        </div>
        <div className="flex justify-between">
          <span className={colors.text.muted}>{pricesFromLabel}</span>
          <span className="font-medium">{pricesFromValue}</span>
        </div>
      </div>
    </div>
  );
}
