"use client";

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { FileText } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { EmptyState as SharedEmptyState } from '@/components/shared/EmptyState';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface EmptyStateProps {
  readOnly: boolean;
  onAddSection: () => void;
}

export function EmptyState({ readOnly, onAddSection }: EmptyStateProps) {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const colors = useSemanticColors();
  return (
    <SharedEmptyState
      icon={FileText}
      iconColor={`${colors.text.muted}/50`}
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
