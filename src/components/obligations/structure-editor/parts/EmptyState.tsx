"use client";

import { FileText } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { EmptyState as SharedEmptyState } from '@/components/shared/EmptyState';

interface EmptyStateProps {
  readOnly: boolean;
  onAddSection: () => void;
}

export function EmptyState({ readOnly, onAddSection }: EmptyStateProps) {
  const { t } = useTranslation('common');
  return (
    <SharedEmptyState
      icon={FileText}
      iconColor="text-muted-foreground/50"
      title={t('obligations.noSections')}
      description={t('obligations.startByAddingSection')}
      size="lg"
      variant="card"
      action={!readOnly ? {
        label: t('obligations.addSection'),
        onClick: onAddSection,
      } : undefined}
    />
  );
}
