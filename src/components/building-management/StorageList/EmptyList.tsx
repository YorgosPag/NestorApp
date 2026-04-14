'use client';

import React from 'react';
import { Archive } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { EmptyState } from '@/components/shared/EmptyState';

export function EmptyList() {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  return (
    <EmptyState
      icon={Archive}
      title={t('emptyList.noUnitsFound')}
      description={t('emptyList.noUnitsDescription')}
      variant="card"
    />
  );
}
