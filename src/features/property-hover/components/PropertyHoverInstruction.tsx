// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';
import { MousePointer } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from 'react-i18next';
import '@/lib/design-system';

export function PropertyHoverInstruction() {
  const { t } = useTranslation('properties');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  return (
    <div className={`flex items-center gap-1 text-xs ${colors.text.muted}`}>
      <MousePointer className={iconSizes.xs} />
      <span>{t('hover.clickForMore')}</span>
    </div>
  );
}
