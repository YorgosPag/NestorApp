// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import { ToolbarButton } from '@/components/ui/ToolbarButton';
import { SortAsc, SortDesc } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from 'react-i18next';

export function SortToggleButton({
  sortDirection,
  onToggleSort,
}: {
  sortDirection: 'asc' | 'desc';
  onToggleSort: () => void;
}) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  return (
    <ToolbarButton
      tooltip={t(sortDirection === 'asc' ? 'toolbar.sortAsc' : 'toolbar.sortDesc')}
      onClick={onToggleSort}
    >
      {sortDirection === 'asc' ? <SortAsc className={iconSizes.sm} /> : <SortDesc className={iconSizes.sm} />}
    </ToolbarButton>
  );
}
