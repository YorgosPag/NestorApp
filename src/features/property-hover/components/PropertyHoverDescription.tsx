// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

export function PropertyHoverDescription({ text }:{ text: string }) {
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  const colors = useSemanticColors();
  return (
    <div className="space-y-1">
      <p className={`text-xs ${colors.text.muted}`}>{t('hover.shortDescription')}:</p>
      <p className="text-xs leading-relaxed">{text}</p>
    </div>
  );
}
