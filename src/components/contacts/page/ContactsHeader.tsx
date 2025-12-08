'use client';

import React from 'react';
import { Users, Filter } from 'lucide-react';
import { PageHeader } from '@/core/headers';
import type { ViewMode as CoreViewMode } from '@/core/headers';
import type { ViewMode } from '@/hooks/useContactsState';


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
    <div className="mobile-search-container">
      <style jsx>{`
        @media (max-width: 767px) {
          .mobile-search-container:has(input:focus) > div > div > div:first-child {
            display: none !important;
          }
          .mobile-search-container:has(input:focus) > div > div > div:last-child {
            display: none !important;
          }
        }
      `}</style>
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

    </div>
  );
}
