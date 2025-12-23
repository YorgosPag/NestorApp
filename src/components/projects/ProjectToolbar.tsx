
'use client';

import React from 'react';
import { ToolbarTabs } from '@/components/ui/navigation/TabsComponents';
import {
  Settings,
  Download,
  Settings as ManagementIcon,
  Wrench,
  Search
} from 'lucide-react';
import {
  ActionsTabContent,
  ImportExportTabContent,
  ManagementTabContent,
  ToolsTabContent,
  SearchFiltersTabContent
} from './ProjectsTabContent';

interface ProjectToolbarProps {
  selectedItems?: number[];
  onSelectionChange?: (items: number[]) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  activeFilters?: string[];
  onFiltersChange?: (filters: string[]) => void;
  onNewProject?: () => void;
  onEditProject?: (id: string) => void;
  onDeleteProject?: (ids: string[]) => void;
  onExport?: () => void;
  onRefresh?: () => void;
}

export function ProjectToolbar({
  selectedItems = [],
  onSelectionChange,
  searchTerm = '',
  onSearchChange,
  activeFilters = [],
  onFiltersChange,
  onNewProject,
  onEditProject,
  onDeleteProject,
  onExport,
  onRefresh
}: ProjectToolbarProps) {

  const handleStatusChange = (value: string) => {
    // Remove all existing status filters
    const newFilters = activeFilters.filter(f => !['in_progress', 'planning', 'completed', 'on_hold'].includes(f));
    // Add new status filter if not 'all'
    if (value !== 'all') {
      newFilters.push(value);
    }
    onFiltersChange?.(newFilters);
  };

  const handleTypeChange = (value: string) => {
    // Remove all existing type filters
    const newFilters = activeFilters.filter(f => !['residential', 'commercial', 'infrastructure'].includes(f));
    // Add new type filter if not 'all'
    if (value !== 'all') {
      newFilters.push(value);
    }
    onFiltersChange?.(newFilters);
  };

  const getCurrentStatusFilter = () => {
    const statusFilterValue = activeFilters.find(f => ['in_progress', 'planning', 'completed', 'on_hold'].includes(f));
    return statusFilterValue || 'all';
  };

  const getCurrentTypeFilter = () => {
    const typeFilterValue = activeFilters.find(f => ['residential', 'commercial', 'infrastructure'].includes(f));
    return typeFilterValue || 'all';
  };

  // Status tabs configuration
  const statusTabs = [
    { value: 'all', label: 'Όλες' },
    { value: 'in_progress', label: 'Σε εξέλιξη' },
    { value: 'planning', label: 'Σχεδιασμένα' },
    { value: 'completed', label: 'Ολοκληρωμένα' },
    { value: 'on_hold', label: 'Σε αναμονή' },
  ];

  // Type tabs configuration
  const typeTabs = [
    { value: 'all', label: 'Όλα' },
    { value: 'residential', label: 'Οικιστικό' },
    { value: 'commercial', label: 'Επαγγελματικό' },
    { value: 'infrastructure', label: 'Υποδομές' },
  ];

  // Define tabs configuration - similar to ContactsToolbar
  const tabs = [
    {
      id: 'actions',
      label: 'Ενέργειες',
      icon: Settings,
      content: (
        <ActionsTabContent
          selectedItems={selectedItems}
          onNewProject={onNewProject}
          onEditProject={onEditProject}
          onDeleteProject={onDeleteProject}
        />
      )
    },
    {
      id: 'import-export',
      label: 'Εισαγ./Εξαγ.',
      icon: Download,
      content: (
        <ImportExportTabContent
          onExport={onExport}
        />
      )
    },
    {
      id: 'management',
      label: 'Διαχείριση',
      icon: ManagementIcon,
      content: (
        <ManagementTabContent
          selectedItems={selectedItems}
          onRefresh={onRefresh}
        />
      )
    },
    {
      id: 'tools',
      label: 'Εργαλεία',
      icon: Wrench,
      content: (
        <ToolsTabContent
          selectedItems={selectedItems}
        />
      )
    },
    {
      id: 'search-filters',
      label: 'Φίλτρα',
      icon: Search,
      content: (
        <SearchFiltersTabContent
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
          activeFilters={activeFilters}
          onFiltersChange={onFiltersChange}
          getCurrentStatusFilter={getCurrentStatusFilter}
          getCurrentTypeFilter={getCurrentTypeFilter}
          handleStatusChange={handleStatusChange}
          handleTypeChange={handleTypeChange}
          statusTabs={statusTabs}
          typeTabs={typeTabs}
        />
      )
    }
  ];

  // Selection message
  const selectionMessage = selectedItems.length > 0
    ? `${selectedItems.length} επιλεγμένα έργα`
    : undefined;

  return (
    <div className="space-y-3 border-b p-3">
      {/* Tabbed Toolbar */}
      <ToolbarTabs
        tabs={tabs}
        defaultTab="actions"
        selectedItems={selectedItems}
        selectionMessage={selectionMessage}
        theme="default"
      />

    </div>
  );
}
