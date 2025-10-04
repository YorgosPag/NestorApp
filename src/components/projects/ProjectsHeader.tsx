'use client';

import React from 'react';
import { HeaderTitle } from './page/HeaderTitle';
import { HeaderActions } from './page/HeaderActions';
import { SearchAndFilters } from './page/SearchAndFilters';
import { ViewModeToggle } from './page/ViewModeToggle';
import type { ProjectStatus } from '@/types/project';


interface ProjectsHeaderProps {
  viewMode: 'list' | 'grid';
  setViewMode: (mode: 'list' | 'grid') => void;
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterCompany: string;
  setFilterCompany: (company: string) => void;
  companies: { id: string; name: string }[];
  filterStatus: string;
  setFilterStatus: (status: string) => void;
}

export function ProjectsHeader(props: ProjectsHeaderProps) {
    const {
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    ...searchAndFilterProps
  } = props;

  return (
    <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40 p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <HeaderTitle />
          <div className="flex items-center gap-2">
            <HeaderActions 
              showDashboard={showDashboard}
              setShowDashboard={setShowDashboard}
            />
            <ViewModeToggle
              viewMode={viewMode}
              setViewMode={setViewMode}
            />
          </div>
        </div>
        <SearchAndFilters {...searchAndFilterProps} />
      </div>
    </div>
  );
}
