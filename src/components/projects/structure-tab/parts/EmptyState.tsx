'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { EmptyState as SharedEmptyState } from '@/components/shared/EmptyState';

export function EmptyState({ projectId }: { projectId: string }) {
  const { t } = useTranslation('projects');
  return (
    <SharedEmptyState
      title={t('structure.notFound')}
      description={`Project ID: ${projectId}`}
      size="sm"
    />
  );
}
