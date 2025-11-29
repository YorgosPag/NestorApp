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
  filterType: ContactTypeFilter;
  setFilterType: (type: ContactTypeFilter) => void;
  showOnlyOwners: boolean;
  onShowOnlyOwnersChange: (checked: boolean) => void;
  showOnlyFavorites: boolean;
  onShowOnlyFavoritesChange: (checked: boolean) => void;
  showArchivedContacts?: boolean;
  onShowArchivedContactsChange?: (checked: boolean) => void;
  unitsCountFilter: UnitsCountFilter;
  setUnitsCountFilter: (filter: UnitsCountFilter) => void;
  areaFilter: AreaFilter;
  setAreaFilter: (filter: AreaFilter) => void;
  onNewContact?: () => void;
}

export function ContactsHeader({
  viewMode,
  setViewMode,
  showDashboard,
  setShowDashboard,
  searchTerm,
  setSearchTerm,
  filterType,
  setFilterType,
  showOnlyOwners,
  onShowOnlyOwnersChange,
  showOnlyFavorites,
  onShowOnlyFavoritesChange,
  showArchivedContacts,
  onShowArchivedContactsChange,
  unitsCountFilter,
  setUnitsCountFilter,
  areaFilter,
  setAreaFilter,
  onNewContact,
}: ContactsHeaderProps) {
  const hasActiveFilters = searchTerm !== '' || filterType !== 'all' || showOnlyOwners || showOnlyFavorites || unitsCountFilter !== 'all' || areaFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setFilterType('all');
    onShowOnlyOwnersChange(false);
    onShowOnlyFavoritesChange(false);
    setUnitsCountFilter('all');
    setAreaFilter('all');
  };

  return (
    <PageHeader
      variant="sticky"
      layout="multi-row"
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
      filters={{
        filters: [
          {
            key: 'type',
            value: filterType,
            onChange: (value) => setFilterType(value as ContactTypeFilter),
            options: [
              { value: 'all', label: 'Όλοι οι τύποι' },
              { value: 'individual', label: 'Φυσικά Πρόσωπα' },
              { value: 'company', label: 'Νομικά Πρόσωπα' },
              { value: 'service', label: 'Υπηρεσίες' }
            ],
            placeholder: 'Τύπος επαφής'
          },
          {
            key: 'units',
            value: unitsCountFilter,
            onChange: setUnitsCountFilter,
            options: [
              { value: 'all', label: 'Όλες οι μονάδες' },
              { value: '1-2', label: '1-2 μονάδες' },
              { value: '3-5', label: '3-5 μονάδες' },
              { value: '6+', label: '6+ μονάδες' }
            ],
            placeholder: 'Πλήθος μονάδων'
          },
          {
            key: 'area',
            value: areaFilter,
            onChange: setAreaFilter,
            options: [
              { value: 'all', label: 'Όλα τα εμβαδά' },
              { value: '0-100', label: 'Έως 100 τ.μ.' },
              { value: '101-300', label: '101 - 300 τ.μ.' },
              { value: '301+', label: '301+ τ.μ.' }
            ],
            placeholder: 'Συνολικό εμβαδόν'
          }
        ],
        checkboxFilters: [
          {
            key: 'owners',
            checked: showOnlyOwners,
            onChange: onShowOnlyOwnersChange,
            label: 'Μόνο με ιδιοκτησίες'
          },
          {
            key: 'favorites',
            checked: showOnlyFavorites,
            onChange: onShowOnlyFavoritesChange,
            label: 'Αγαπημένα',
            icon: Star
          }
        ],
        hasActiveFilters,
        onClearFilters: clearFilters
      }}
      actions={{
        showDashboard,
        onDashboardToggle: () => setShowDashboard(!showDashboard),
        viewMode: viewMode as CoreViewMode,
        onViewModeChange: (mode) => setViewMode(mode as ViewMode),
        addButton: {
          label: 'Νέα Επαφή',
          onClick: () => onNewContact?.()
        }
      }}
    />
  );
}
