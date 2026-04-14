// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import { ToolbarButton } from '@/components/ui/ToolbarButton';
import { RefreshCw } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

export function RefreshButton({ onRefresh }: { onRefresh: () => void }) {
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const iconSizes = useIconSizes();
  return (
    <ToolbarButton tooltip={t('toolbar.refresh')} onClick={onRefresh}>
      <RefreshCw className={iconSizes.sm} />
    </ToolbarButton>
  );
}
