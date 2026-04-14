"use client";

import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { EmptyState } from '@/components/shared/EmptyState';
import '@/lib/design-system';

const PropertyIcon = NAVIGATION_ENTITIES.property.icon;
const propertyColor = NAVIGATION_ENTITIES.property.color;

export function PropertyListEmptyState() {
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  return (
    <EmptyState
      icon={PropertyIcon}
      iconColor={propertyColor}
      title={t('grid.emptyState.title')}
      description={t('grid.emptyState.subtitle')}
      size="sm"
      className="h-full"
    />
  );
}
