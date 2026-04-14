'use client';

import React from 'react';
import { Users } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { EmptyState as SharedEmptyState } from '@/components/shared/EmptyState';

export function EmptyState() {
  const { t } = useTranslation(['projects', 'projects-data', 'projects-ika']);
  return (
    <SharedEmptyState
      icon={Users}
      title={t('customers.title')}
      description={t('customers.emptyDescription')}
      variant="card"
    />
  );
}
