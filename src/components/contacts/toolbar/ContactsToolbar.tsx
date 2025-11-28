'use client';

import React from 'react';
import { Settings, MessageSquare, FolderOpen, Star } from 'lucide-react';
import { ToolbarTabs } from '@/components/ui/navigation/TabsComponents';
import {
  ActionsTabContent,
  CommunicationTabContent,
  ManagementTabContent,
  FiltersTabContent
} from './ContactsTabContent';

interface ContactsToolbarProps {
  selectedItems?: string[];
  onSelectionChange?: (items: string[]) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  activeFilters?: string[];
  onFiltersChange?: (filters: string[]) => void;
  onNewContact?: () => void;
  onEditContact?: () => void;
  onDeleteContact?: (ids?: string[]) => void;
  onArchiveContact?: (ids?: string[]) => void;
  onExport?: () => void;
  onRefresh?: () => void;
  hasSelectedContact?: boolean;
  showOnlyFavorites?: boolean;
  onToggleFavoritesFilter?: () => void;
  showArchivedContacts?: boolean;
  onToggleArchivedFilter?: () => void;
}

export function ContactsToolbar(props: ContactsToolbarProps) {
  const {
    selectedItems = [],
    onNewContact,
    onEditContact,
    onDeleteContact,
    onArchiveContact,
    onExport,
    onRefresh,
    hasSelectedContact = false,
    showOnlyFavorites = false,
    onToggleFavoritesFilter,
    showArchivedContacts = false,
    onToggleArchivedFilter
  } = props;

  // Define tabs configuration
  const tabs = [
    {
      id: 'actions',
      label: 'Ενέργειες',
      icon: Settings,
      content: (
        <ActionsTabContent
          selectedItems={selectedItems}
          hasSelectedContact={hasSelectedContact}
          onNewContact={onNewContact}
          onEditContact={onEditContact}
          onDeleteContact={onDeleteContact}
          onArchiveContact={onArchiveContact}
          onRefresh={onRefresh}
        />
      )
    },
    {
      id: 'communication',
      label: 'Επικοινωνία',
      icon: MessageSquare,
      content: (
        <CommunicationTabContent
          selectedItems={selectedItems}
        />
      )
    },
    {
      id: 'management',
      label: 'Διαχείριση',
      icon: FolderOpen,
      content: (
        <ManagementTabContent
          selectedItems={selectedItems}
          hasSelectedContact={hasSelectedContact}
          onExport={onExport}
          onArchiveContact={onArchiveContact}
        />
      )
    },
    {
      id: 'filters',
      label: 'Φίλτρα',
      icon: Star,
      content: (
        <FiltersTabContent
          showOnlyFavorites={showOnlyFavorites}
          showArchivedContacts={showArchivedContacts}
          onToggleFavoritesFilter={onToggleFavoritesFilter}
          onToggleArchivedFilter={onToggleArchivedFilter}
        />
      )
    }
  ];

  // Selection message
  const selectionMessage = selectedItems.length > 0
    ? `${selectedItems.length} επιλεγμένες επαφές`
    : undefined;

  return (
    <ToolbarTabs
      tabs={tabs}
      defaultTab="actions"
      selectedItems={selectedItems}
      selectionMessage={selectionMessage}
      theme="warning"
    />
  );
}
