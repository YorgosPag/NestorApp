'use client';

import React from 'react';
import { Users, Filter } from 'lucide-react';
import { PageHeader } from '@/core/headers';
import type { ViewMode as CoreViewMode } from '@/core/headers';
import type { ViewMode } from '@/hooks/useContactsState';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';


interface ContactsHeaderProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onNewContact?: () => void;
  // Mobile-only filter toggle
  showFilters?: boolean;
  setShowFilters?: (show: boolean) => void;
}

export function ContactsHeader({
  viewMode,
  setViewMode,
  showDashboard,
  setShowDashboard,
  searchTerm,
  setSearchTerm,
  onNewContact,
  showFilters,
  setShowFilters,
}: ContactsHeaderProps) {
  return (
    <PageHeader
      variant="sticky-rounded"
      layout="compact"
      spacing="compact"
      title={{
        icon: Users,
        title: "Διαχείριση Επαφών",
        subtitle: "Κεντρικό ευρετήριο όλων των επαφών σας"
      }}
      search={{
        value: searchTerm,
        onChange: setSearchTerm,
        placeholder: "Αναζήτηση επαφών..."
      }}
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        viewMode: viewMode as CoreViewMode,
        onViewModeChange: (mode) => setViewMode(mode as ViewMode),
        viewModes: ['list', 'grid'] as CoreViewMode[],
        addButton: {
          label: 'Νέα Επαφή',
          onClick: () => onNewContact?.()
        },
        customActions: setShowFilters ? [
          React.createElement('button', {
            key: 'mobile-filter',
            onClick: () => setShowFilters(!showFilters),
            className: `md:hidden p-2 rounded-md border ${TRANSITION_PRESETS.STANDARD_COLORS} ${
              showFilters
                ? 'bg-primary text-primary-foreground border-primary'
                : `bg-background border-border ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
            }`,
            'aria-label': 'Toggle filters',
            children: React.createElement(Filter, { className: 'h-4 w-4' })
          })
        ] : undefined
      }}
    />
  );
}
