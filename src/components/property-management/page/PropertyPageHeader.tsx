'use client';

import React from 'react';
import { PageHeader } from '@/core/headers';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { CommonBadge } from '@/core/badges';
import type { ViewMode } from '@/core/headers';

interface PropertyPageHeaderProps {
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  viewMode: 'list' | 'grid';
  setViewMode: (mode: 'list' | 'grid') => void;
}

export function PropertyPageHeader({
  showDashboard,
  setShowDashboard,
  viewMode,
  setViewMode
}: PropertyPageHeaderProps) {
  return (
    <PageHeader
      variant="static"
      layout="single-row"
      title={{
        icon: NAVIGATION_ENTITIES.unit.icon,
        title: "Διαχείριση Ακινήτων",
        badge: (
          <CommonBadge
            status="property"
            customLabel="Διαχείριση και παρακολούθηση ακινήτων έργων"
            variant="secondary"
            className="text-xs"
          />
        )
      }}
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        viewMode: viewMode as ViewMode,
        onViewModeChange: (mode) => setViewMode(mode as 'list' | 'grid'),
        addButton: {
          label: 'Νέο Ακίνητο',
          onClick: () => console.log('Add property')
        }
      }}
    />
  );
}
