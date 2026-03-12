"use client";

import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { EmptyState } from '@/components/shared/EmptyState';

const UnitIcon = NAVIGATION_ENTITIES.unit.icon;
const unitColor = NAVIGATION_ENTITIES.unit.color;

export function PropertyListEmptyState() {
  const { t } = useTranslation('properties');
  return (
    <EmptyState
      icon={UnitIcon}
      iconColor={unitColor}
      title={t('grid.emptyState.title')}
      description={t('grid.emptyState.subtitle')}
      size="sm"
      className="h-full"
    />
  );
}
