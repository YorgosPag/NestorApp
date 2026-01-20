
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
import { UNIFIED_STATUS_FILTER_LABELS, COMMON_FILTER_LABELS, PROJECT_TYPE_LABELS } from '@/constants/property-statuses-enterprise';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ProjectToolbarProps {
  selectedItems?: number[];
  onSelectionChange?: (items: number[]) => void;
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
  activeFilters = [],
  onFiltersChange,
  onNewProject,
  onEditProject,
  onDeleteProject,
  onExport,
  onRefresh
}: ProjectToolbarProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');

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
    { value: 'all', label: COMMON_FILTER_LABELS.ALL_STATUSES },
    { value: 'in_progress', label: UNIFIED_STATUS_FILTER_LABELS.IN_PROGRESS },
    { value: 'planning', label: UNIFIED_STATUS_FILTER_LABELS.PLANNING },
    { value: 'completed', label: UNIFIED_STATUS_FILTER_LABELS.COMPLETED },
    { value: 'on_hold', label: UNIFIED_STATUS_FILTER_LABELS.ON_HOLD },
  ];

  // Type tabs configuration
  const typeTabs = [
    { value: 'all', label: COMMON_FILTER_LABELS.ALL_TYPES },
    { value: 'residential', label: PROJECT_TYPE_LABELS.residential },
    { value: 'commercial', label: PROJECT_TYPE_LABELS.commercial },
    { value: 'infrastructure', label: PROJECT_TYPE_LABELS.infrastructure },
  ];

  // Define tabs configuration - similar to ContactsToolbar
  // 🏢 ENTERPRISE: Using i18n for all tab labels
  const tabs = [
    {
      id: 'actions',
      label: t('toolbarGroups.actions'),
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
      label: t('toolbarGroups.importExport'),
      icon: Download,
      content: (
        <ImportExportTabContent
          onExport={onExport}
        />
      )
    },
    {
      id: 'management',
      label: t('toolbarGroups.management'),
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
      label: t('toolbarGroups.tools'),
      icon: Wrench,
      content: (
        <ToolsTabContent
          selectedItems={selectedItems}
        />
      )
    },
    {
      id: 'search-filters',
      label: t('toolbarGroups.filters'),
      icon: Search,
      content: (
        <SearchFiltersTabContent
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

  // Selection message - 🏢 ENTERPRISE: Using i18n
  const selectionMessage = selectedItems.length > 0
    ? `${selectedItems.length} ${t('toolbar.selection.selected')}`
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
