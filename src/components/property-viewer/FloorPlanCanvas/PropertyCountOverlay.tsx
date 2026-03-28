

'use client';

import { useBorderTokens } from '@/hooks/useBorderTokens';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

interface PropertyCountOverlayProps {
  count: number;
}

export function PropertyCountOverlay({ count }: PropertyCountOverlayProps) {
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');

  return (
    <div className={`${colors.bg.primary}/80 backdrop-blur-sm ${quick.card} px-3 py-1 shadow-sm`}>
      <span className={cn("text-xs", colors.text.muted)}>
        {t('propertyCount.propertiesOnFloor', { count })}
      </span>
    </div>
  );
}
