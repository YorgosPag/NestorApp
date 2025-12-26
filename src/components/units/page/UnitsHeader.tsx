'use client';

import React from 'react';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { Home, Filter } from 'lucide-react';
import { PageHeader } from '@/core/headers';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import type { ViewMode as CoreViewMode } from '@/core/headers';

export type UnitsViewMode = 'list' | 'grid';

interface UnitsHeaderProps {
  viewMode: UnitsViewMode;
  setViewMode: (mode: UnitsViewMode) => void;
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onNewUnit?: () => void;
  // Mobile-only filter toggle
  showFilters?: boolean;
  setShowFilters?: (show: boolean) => void;
}

export function UnitsHeader({
  viewMode,
  setViewMode,
  showDashboard,
  setShowDashboard,
  searchTerm,
  setSearchTerm,
  onNewUnit,
  showFilters,
  setShowFilters,
}: UnitsHeaderProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  return (
    <PageHeader
        variant="sticky-rounded"
        layout="compact"
        spacing="compact"
        title={{
          icon: Home,
          title: "Διαχείριση Μονάδων",
          subtitle: "Κεντρικό ευρετήριο όλων των μονάδων σας"
        }}
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: "Αναζήτηση μονάδων..."
        }}
        actions={{
          showDashboard,
          onDashboardToggle: () => setShowDashboard(!showDashboard),
          viewMode: viewMode as CoreViewMode,
          onViewModeChange: (mode) => setViewMode(mode as UnitsViewMode),
          viewModes: ['list', 'grid'] as CoreViewMode[],
          addButton: {
            label: 'Νέα Μονάδα',
            onClick: () => onNewUnit?.()
          },
          // Mobile-only filter button
          customActions: setShowFilters ? [
            <button
              key="mobile-filter"
              onClick={() => setShowFilters(!showFilters)}
              className={`md:hidden p-2 rounded-md ${TRANSITION_PRESETS.STANDARD_COLORS} ${
                showFilters
                  ? `bg-primary text-primary-foreground ${quick.focus}`
                  : `bg-background ${quick.input} ${INTERACTIVE_PATTERNS.BUTTON_SUBTLE}`
              }`}
              aria-label="Toggle filters"
            >
              <Filter className={iconSizes.sm} />
            </button>
          ] : undefined
        }}
      />
  );
}