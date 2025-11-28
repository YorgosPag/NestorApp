'use client';

import React from 'react';
import { HeaderTitle } from './page/HeaderTitle';
import { HeaderActions } from './page/HeaderActions';
import { ViewModeToggle } from './page/ViewModeToggle';


interface ProjectsHeaderProps {
  viewMode: 'list' | 'grid' | 'byType' | 'byStatus';
  setViewMode: (mode: 'list' | 'grid' | 'byType' | 'byStatus') => void;
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
}

export function ProjectsHeader(props: ProjectsHeaderProps) {
  const {
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
  } = props;

  return (
    <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40 p-4">
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
    </div>
  );
}
