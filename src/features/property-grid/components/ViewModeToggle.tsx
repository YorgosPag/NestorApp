'use client';
import { Grid, List } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function ViewModeToggle({ value, onChange }: { value: 'grid'|'list'; onChange: (v:'grid'|'list')=>void; }) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { radius } = useBorderTokens();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');

  return (
    <div className={`flex ${colors.bg.secondary} ${radius.lg} p-1`}>
      <button
        onClick={() => onChange('grid')}
        className={`px-3 py-1.5 ${radius.md} flex items-center gap-2 transition-colors ${
          value === 'grid' ? `${colors.bg.primary} shadow-sm ${colors.text.info}` : colors.text.muted
        }`}
      >
        <Grid className={iconSizes.sm} />
        <span className="text-sm font-medium">{t('grid.viewMode.grid')}</span>
      </button>
      <button
        onClick={() => onChange('list')}
        className={`px-3 py-1.5 ${radius.md} flex items-center gap-2 transition-colors ${
          value === 'list' ? `${colors.bg.primary} shadow-sm ${colors.text.info}` : colors.text.muted
        }`}
      >
        <List className={iconSizes.sm} />
        <span className="text-sm font-medium">{t('grid.viewMode.list')}</span>
      </button>
    </div>
  );
}
