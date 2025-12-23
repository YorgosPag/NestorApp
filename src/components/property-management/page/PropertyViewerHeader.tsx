
'use client';

import React from 'react';
import { Home } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Filter } from 'lucide-react';
import { PropertyViewerFilters } from '@/components/property-viewer/PropertyViewerFilters';
import type { FilterState } from '@/types/property-viewer';
import { PageHeader } from '@/core/headers';
import type { ViewMode as CoreViewMode } from '@/core/headers';

interface PropertyViewerHeaderProps {
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  viewMode: 'list' | 'grid';
  setViewMode: (mode: 'list' | 'grid') => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export function PropertyViewerHeader({
  showDashboard,
  setShowDashboard,
  viewMode,
  setViewMode,
  filters,
  onFiltersChange
}: PropertyViewerHeaderProps) {
  const iconSizes = useIconSizes();

  return (
    <div className="shrink-0">
      <PageHeader
        variant="static"
        layout="single-row"
        title={{
          icon: Home,
          title: "Ευρετήριο Ακινήτων",
          subtitle: "Οπτική διαχείριση και ανάλυση ακινήτων σε κάτοψη."
        }}
        actions={{
          showDashboard,
          onDashboardToggle: () => setShowDashboard(!showDashboard),
          viewMode: viewMode as CoreViewMode,
          onViewModeChange: (mode) => setViewMode(mode as 'list' | 'grid'),
          viewModes: ['list', 'grid'] as CoreViewMode[],
          addButton: {
            label: 'Νέο Ακίνητο',
            onClick: () => console.log('Add property')
          }
        }}
      />
      <div className="border-b bg-card p-4">
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-start p-4 text-sm font-semibold">
              <Filter className={`${iconSizes.sm} mr-2`}/>
              Φίλτρα Αναζήτησης
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <PropertyViewerFilters filters={filters} onFiltersChange={onFiltersChange} />
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
