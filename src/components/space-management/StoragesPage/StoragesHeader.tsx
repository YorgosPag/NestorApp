'use client';

import React from 'react';
import { Warehouse, Filter } from 'lucide-react';
import { PageHeader } from '@/core/headers';
import type { ViewMode } from '@/core/headers';
import { TRANSITION_PRESETS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';

interface StoragesHeaderProps {
  viewMode: 'list' | 'grid' | 'byType' | 'byStatus';
  setViewMode: (mode: 'list' | 'grid' | 'byType' | 'byStatus') => void;
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onNewStorage?: () => void;
  // Mobile-only filter toggle
  showFilters?: boolean;
  setShowFilters?: (show: boolean) => void;
}

export function StoragesHeader({
  viewMode,
  setViewMode,
  showDashboard,
  setShowDashboard,
  searchTerm,
  setSearchTerm,
  onNewStorage,
  showFilters,
  setShowFilters,
}: StoragesHeaderProps) {
  return (
    <PageHeader
      variant="sticky-rounded"
      layout="compact"
      spacing="compact"
      title={{
        icon: Warehouse,
        title: "Διαχείριση Αποθηκών",
        subtitle: "Διαχείριση και παρακολούθηση χώρων αποθήκευσης"
      }}
      search={{
        value: searchTerm,
        onChange: setSearchTerm,
        placeholder: "Αναζήτηση αποθηκών..."
      }}
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        viewMode: viewMode as ViewMode,
        onViewModeChange: (mode) => setViewMode(mode as any),
        viewModes: ['list', 'grid', 'byType', 'byStatus'] as ViewMode[],
        addButton: {
          label: 'Νέα Αποθήκη',
          onClick: () => onNewStorage?.() || console.log('Add storage')
        },
        // Mobile-only filter button
        customActions: setShowFilters ? [
          <button
            key="mobile-filter"
            onClick={() => setShowFilters(!showFilters)}
            className={`md:hidden p-2 rounded-md border ${TRANSITION_PRESETS.STANDARD_COLORS} ${
              showFilters
                ? 'bg-primary text-primary-foreground border-primary'
                : `bg-background border-border ${INTERACTIVE_PATTERNS.ACCENT_HOVER}`
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