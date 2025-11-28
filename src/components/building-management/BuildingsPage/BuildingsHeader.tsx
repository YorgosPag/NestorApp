
'use client';

import React from 'react';
import { Building2 } from 'lucide-react';
import { HeaderActions } from './HeaderActions';
import { ViewModeToggle } from './ViewModeToggle';

interface BuildingsHeaderProps {
  viewMode: 'list' | 'grid' | 'byType' | 'byStatus';
  setViewMode: (mode: 'list' | 'grid' | 'byType' | 'byStatus') => void;
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
}

export function BuildingsHeader(props: BuildingsHeaderProps) {
  const {
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard
  } = props;
  
  return (
    <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40 p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Διαχείριση Κτιρίων</h1>
              <p className="text-sm text-muted-foreground">
                Διαχείριση και παρακολούθηση κτιριακών έργων
              </p>
            </div>
          </div>
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
    </div>
  );
}
