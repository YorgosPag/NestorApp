'use client';

import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

// 🏢 ENTERPRISE: Centralized Unit Icon & Color
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;
const unitColor = NAVIGATION_ENTITIES.unit.color;

interface EmptyLayerMessageProps {
  searchQuery: string;
}

export function EmptyLayerMessage({ searchQuery }: EmptyLayerMessageProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('common');

  return (
    <div className={cn("text-center py-8", colors.text.muted)}>
      <UnitIcon className={`${iconSizes.xl} mx-auto mb-2 ${unitColor}`} />
      <p className="text-sm">{t('layerManager.noLayersFound')}</p>
      {searchQuery ? (
        <p className="text-xs mt-1 italic">
          {t('layerManager.noResultsFor', { query: searchQuery })}
        </p>
      ) : (
        <p className="text-xs">{t('layerManager.tryChangingFilters')}</p>
      )}
    </div>
  );
}
