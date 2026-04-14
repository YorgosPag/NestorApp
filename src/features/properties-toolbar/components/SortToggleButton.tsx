// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import { ToolbarButton } from '@/components/ui/ToolbarButton';
import { SortAsc, SortDesc } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

export function SortToggleButton({
  sortDirection,
  onToggleSort,
}: {
  sortDirection: 'asc' | 'desc';
  onToggleSort: () => void;
}) {
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
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
