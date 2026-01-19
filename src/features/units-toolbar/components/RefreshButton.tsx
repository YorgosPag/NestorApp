// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import { ToolbarButton } from '@/components/ui/ToolbarButton';
import { RefreshCw } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from 'react-i18next';

export function RefreshButton({ onRefresh }: { onRefresh: () => void }) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  return (
    <ToolbarButton tooltip={t('toolbar.refresh')} onClick={onRefresh}>
      <RefreshCw className={iconSizes.sm} />
    </ToolbarButton>
  );
}
