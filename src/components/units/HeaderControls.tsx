
'use client';

import React from 'react';
import { Building } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { PageHeader } from '@/core/headers';
import type { ViewMode as CoreViewMode } from '@/core/headers';

interface HeaderControlsProps {
  viewMode: 'list' | 'grid' | 'byType' | 'byStatus';
  setViewMode: (mode: 'list' | 'grid' | 'byType' | 'byStatus') => void;
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
}

export function HeaderControls({
  viewMode,
  setViewMode,
  showDashboard,
  setShowDashboard,
}: HeaderControlsProps) {
  const { t } = useTranslation('units');

  return (
    <PageHeader
      variant="static"
      layout="single-row"
      title={{
        icon: Building,
        title: t('management.title'),
        subtitle: t('management.subtitle')
      }}
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        viewMode: viewMode as CoreViewMode,
        onViewModeChange: (mode) => setViewMode(mode as any),
        viewModes: ['list', 'grid', 'byType', 'byStatus'] as CoreViewMode[],
        addButton: {
          label: t('actions.newUnit'),
          onClick: () => console.log('Add unit')
        }
      }}
    />
  );
}
