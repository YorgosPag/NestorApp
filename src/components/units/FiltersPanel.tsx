
'use client';

import React from 'react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Filter } from 'lucide-react';
import { PropertyViewerFilters, type FilterState } from '@/components/property-viewer/PropertyViewerFilters';

interface FiltersPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export function FiltersPanel({ filters, onFiltersChange }: FiltersPanelProps) {
  return (
    <div className="px-4 pt-4 shrink-0">
      <Collapsible className="border bg-card rounded-lg">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-start p-4 text-sm font-semibold">
            <Filter className="w-4 h-4 mr-2" />
            Φίλτρα Αναζήτησης
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <PropertyViewerFilters filters={filters} onFiltersChange={onFiltersChange} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
