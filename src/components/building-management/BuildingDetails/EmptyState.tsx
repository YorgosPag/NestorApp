'use client';

import React from 'react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { EmptyState as SharedEmptyState } from '@/components/shared/EmptyState';
import '@/lib/design-system';

export function EmptyState() {
  const { t } = useTranslation('building');
  return (
    <SharedEmptyState
      icon={NAVIGATION_ENTITIES.building.icon}
      iconColor={NAVIGATION_ENTITIES.building.color}
      title={t('emptyState.selectBuilding')}
      description={t('emptyState.selectBuildingDescription')}
      size="lg"
      className="flex-1 bg-card min-w-0 shadow-sm rounded-lg border"
    />
  );
}
