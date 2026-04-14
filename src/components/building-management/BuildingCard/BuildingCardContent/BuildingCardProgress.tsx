'use client';

import React from 'react';
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface BuildingCardProgressProps {
  progress: number;
}

export function BuildingCardProgress({ progress }: BuildingCardProgressProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);

  return (
    <ThemeProgressBar
      progress={progress}
      label={t('card.progress.label')}
      size="md"
      showPercentage
    />
  );
}
