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
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

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
  showTrash?: boolean;
  trashCount?: number;
  onToggleTrash?: () => void;
}

export function ContactsToolbar(props: ContactsToolbarProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships']);

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
    onToggleArchivedFilter,
    showTrash = false,
    trashCount = 0,
    onToggleTrash
  } = props;

  // Define tabs configuration
  const tabs = [
    {
      id: 'actions',
      label: t('toolbar.tabs.actions'),
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
      label: t('toolbar.tabs.communication'),
      icon: MessageSquare,
      content: (
        <CommunicationTabContent
          selectedItems={selectedItems}
        />
      )
    },
    {
      id: 'management',
      label: t('toolbar.tabs.management'),
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
      label: t('toolbar.tabs.filters'),
      icon: Star,
      content: (
        <FiltersTabContent
          showOnlyFavorites={showOnlyFavorites}
          showArchivedContacts={showArchivedContacts}
          showTrash={showTrash}
          trashCount={trashCount}
          onToggleFavoritesFilter={onToggleFavoritesFilter}
          onToggleArchivedFilter={onToggleArchivedFilter}
          onToggleTrash={onToggleTrash}
        />
      )
    }
  ];

  // Selection message
  const selectionMessage = selectedItems.length > 0
    ? t('toolbar.selectedContacts', { count: selectedItems.length })
    : undefined;

  return (
    <ToolbarTabs
      tabs={tabs}
      defaultTab="actions"
      selectedItems={selectedItems}
      selectionMessage={selectionMessage}
      theme="default"
    />
  );
}
