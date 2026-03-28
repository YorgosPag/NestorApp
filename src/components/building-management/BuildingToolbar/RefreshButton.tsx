'use client';

import { ToolbarButton } from '@/components/ui/ToolbarButton';
import { RefreshCw } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

export function RefreshButton({ onRefresh }: { onRefresh: () => void }) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  return (
    <ToolbarButton tooltip={t('toolbar.tooltips.refresh')} onClick={onRefresh}>
      <RefreshCw className={iconSizes.sm} />
    </ToolbarButton>
  );
}
