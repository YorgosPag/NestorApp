'use client';

import React from 'react';
import { Users, Hash, Ruler, Star } from 'lucide-react';
import { PageHeader } from '@/core/headers';
import type { ViewMode as CoreViewMode } from '@/core/headers';
import type { UnitsCountFilter, AreaFilter, ContactTypeFilter, ViewMode } from '@/hooks/useContactsState';


interface ContactsHeaderProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onNewContact?: () => void;
}

export function ContactsHeader({
  viewMode,
  setViewMode,
  showDashboard,
  setShowDashboard,
  searchTerm,
  setSearchTerm,
  onNewContact,
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
        }
      }}
    />
  );
}
