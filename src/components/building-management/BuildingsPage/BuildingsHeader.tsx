
'use client';

import React from 'react';
import { Building2, Filter } from 'lucide-react';
import { PageHeader } from '@/core/headers';
import { CompactToolbar, buildingsConfig } from '@/components/core/CompactToolbar';
import type { ViewMode } from '@/core/headers';

interface BuildingsHeaderProps {
  viewMode: 'list' | 'grid' | 'byType' | 'byStatus';
  setViewMode: (mode: 'list' | 'grid' | 'byType' | 'byStatus') => void;
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
}

export function BuildingsHeader({
  viewMode,
  setViewMode,
  showDashboard,
  setShowDashboard
}: BuildingsHeaderProps) {
  return (
    <PageHeader
      variant="sticky"
      layout="single-row"
      title={{
        icon: Building2,
        title: "Διαχείριση Κτιρίων",
        subtitle: "Διαχείριση και παρακολούθηση κτιριακών έργων"
      }}
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        viewMode: viewMode as ViewMode,
        onViewModeChange: (mode) => setViewMode(mode as any),
        viewModes: ['list', 'grid', 'byType', 'byStatus'] as ViewMode[],
        addButton: {
          label: 'Νέο Κτίριο',
          onClick: () => console.log('Add building')
        }
      }}
    />
  );
}
