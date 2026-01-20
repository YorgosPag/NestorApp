'use client';

import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Centralized Unit Icon & Color
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;
const unitColor = NAVIGATION_ENTITIES.unit.color;

interface EmptyLayerMessageProps {
  searchQuery: string;
}

export function EmptyLayerMessage({ searchQuery }: EmptyLayerMessageProps) {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('common');

  return (
    <div className="text-center py-8 text-muted-foreground">
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
