'use client';

import React from 'react';
import { Building2 } from 'lucide-react';
import { PageHeader } from '@/core/headers';
import type { ViewMode } from '@/core/headers';

interface ProjectsHeaderProps {
  viewMode: 'list' | 'byType' | 'byStatus';
  setViewMode: (mode: 'list' | 'byType' | 'byStatus') => void;
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
}

export function ProjectsHeader({
  viewMode,
  setViewMode,
  showDashboard,
  setShowDashboard,
}: ProjectsHeaderProps) {
  return (
    <PageHeader
      variant="sticky"
      layout="single-row"
      title={{
        icon: Building2,
        title: "Διαχείριση Έργων",
        subtitle: "Παρακολούθηση και διαχείριση έργων"
      }}
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        viewMode: viewMode as ViewMode,
        onViewModeChange: (mode) => setViewMode(mode as any),
        viewModes: ['list', 'byType', 'byStatus'] as ViewMode[],
        addButton: {
          label: 'Νέο Έργο',
          onClick: () => console.log('Add project')
        }
      }}
    />
  );
}
