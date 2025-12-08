
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
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onNewBuilding?: () => void;
  // Mobile-only filter toggle
  showFilters?: boolean;
  setShowFilters?: (show: boolean) => void;
}

export function BuildingsHeader({
  viewMode,
  setViewMode,
  showDashboard,
  setShowDashboard,
  searchTerm,
  setSearchTerm,
  onNewBuilding,
  showFilters,
  setShowFilters,
}: BuildingsHeaderProps) {
  return (
    <PageHeader
      variant="sticky-rounded"
      layout="compact"
      spacing="compact"
      title={{
        icon: Building2,
        title: "Διαχείριση Κτιρίων",
        subtitle: "Διαχείριση και παρακολούθηση κτιριακών έργων"
      }}
      search={{
        value: searchTerm,
        onChange: setSearchTerm,
        placeholder: "Αναζήτηση κτιρίων..."
      }}
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        viewMode: viewMode as ViewMode,
        onViewModeChange: (mode) => setViewMode(mode as any),
        viewModes: ['list', 'grid', 'byType', 'byStatus'] as ViewMode[],
        addButton: {
          label: 'Νέο Κτίριο',
          onClick: () => onNewBuilding?.() || console.log('Add building')
        },
        // Mobile-only filter button
        customActions: setShowFilters ? [
          <button
            key="mobile-filter"
            onClick={() => setShowFilters(!showFilters)}
            className={`md:hidden p-2 rounded-md border transition-colors ${
              showFilters
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border hover:bg-accent'
            }`}
            aria-label="Toggle filters"
          >
            <Filter className="h-4 w-4" />
          </button>
        ] : undefined
      }}
    />
  );
}
