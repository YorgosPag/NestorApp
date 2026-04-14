'use client';

import React from 'react';
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ProjectCardProgressProps {
  progress: number;
}

export function ProjectCardProgress({ progress }: ProjectCardProgressProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation(['projects', 'projects-data', 'projects-ika']);

  return (
    <ThemeProgressBar
      progress={progress}
      label={t('projectProgress.label')}
      size="md"
      showPercentage
    />
  );
}
