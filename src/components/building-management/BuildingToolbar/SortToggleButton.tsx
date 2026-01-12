'use client';

import { ToolbarButton } from '@/components/ui/ToolbarButton';
import { SortAsc, SortDesc } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function SortToggleButton({ sortDirection, onToggleSort }: {
  sortDirection: 'asc' | 'desc';
  onToggleSort: () => void;
}) {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');

  const tooltipText = sortDirection === 'asc'
    ? t('toolbar.sort.ascending')
    : t('toolbar.sort.descending');

  return (
    <ToolbarButton
      tooltip={tooltipText}
      onClick={onToggleSort}
    >
      {sortDirection === 'asc' ? <SortAsc className={iconSizes.sm} /> : <SortDesc className={iconSizes.sm} />}
    </ToolbarButton>
  );
}
