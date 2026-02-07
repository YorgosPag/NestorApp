'use client';

import React from 'react';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function EmptyState({ projectId }: { projectId: string }) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  const spacing = useSpacingTokens();
  const colors = useSemanticColors();
  const typography = useTypography();
  return (
    <div className={cn(spacing.padding.md, "text-center")}>
      <div className={cn(colors.text.muted, spacing.margin.bottom.sm)}>{t('structure.notFound')}</div>
      <div className={cn(typography.body.sm, colors.text.muted)}>Project ID: {projectId}</div>
    </div>
  );
}
