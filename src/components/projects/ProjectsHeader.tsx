'use client';

import React from 'react';
import { Building2, Filter } from 'lucide-react';
import { PageHeader } from '@/core/headers';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import type { ViewMode } from '@/core/headers';

interface ProjectsHeaderProps {
  viewMode: 'list' | 'byType' | 'byStatus';
  setViewMode: (mode: 'list' | 'byType' | 'byStatus') => void;
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  searchTerm?: string;
  setSearchTerm?: (term: string) => void;
  onNewProject?: () => void;
  // Mobile-only filter toggle
  showFilters?: boolean;
  setShowFilters?: (show: boolean) => void;
}

export function ProjectsHeader({
  viewMode,
  setViewMode,
  showDashboard,
  setShowDashboard,
  searchTerm,
  setSearchTerm,
  onNewProject,
  showFilters,
  setShowFilters,
}: ProjectsHeaderProps) {
  return (
    <PageHeader
      variant="sticky-rounded"
      layout="compact"
      spacing="compact"
      title={{
        icon: Building2,
        title: "Διαχείριση Έργων",
        subtitle: "Παρακολούθηση και διαχείριση έργων"
      }}
      search={searchTerm !== undefined && setSearchTerm ? {
        value: searchTerm,
        onChange: setSearchTerm,
        placeholder: "Αναζήτηση έργων..."
      } : undefined}
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        viewMode: viewMode as ViewMode,
        onViewModeChange: (mode) => setViewMode(mode as any),
        viewModes: ['list', 'byType', 'byStatus'] as ViewMode[],
        addButton: {
          label: 'Νέο Έργο',
          onClick: () => onNewProject?.() || console.log('Add project')
        },
        // Mobile-only filter button
        customActions: setShowFilters ? [
          <button
            key="mobile-filter"
            onClick={() => setShowFilters(!showFilters)}
            className={`md:hidden p-2 rounded-md border transition-colors ${
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
