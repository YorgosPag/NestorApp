// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';
import { useTranslation } from 'react-i18next';

export function PropertyHoverDescription({ text }:{ text: string }) {
  const { t } = useTranslation('properties');
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{t('hover.shortDescription')}:</p>
      <p className="text-xs leading-relaxed">{text}</p>
    </div>
  );
}
