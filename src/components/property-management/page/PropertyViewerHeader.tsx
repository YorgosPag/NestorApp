
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LayoutGrid, List, BarChart3, Eye, EyeOff, Plus, Home } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Filter } from 'lucide-react';
import { PropertyViewerFilters } from '@/components/property-viewer/PropertyViewerFilters';
import type { FilterState } from '@/types/property-viewer';

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
  return (
    <div className="shrink-0">
        <div className="border-b bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Ευρετήριο Ακινήτων</h1>
                <p className="text-sm text-muted-foreground">
                    Οπτική διαχείριση και ανάλυση ακινήτων σε κάτοψη.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={showDashboard ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowDashboard(!showDashboard)}
                  className="h-8"
                >
                  {showDashboard ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                  {showDashboard ? 'Απόκρυψη' : 'Εμφάνιση'} Dashboard
                </Button>

                <div className="flex border rounded-md bg-background">
                  <Button
                    variant={viewMode === 'list' ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="h-8 rounded-r-none border-0"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'grid' ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="h-8 rounded-l-none border-0"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                </div>

                <Button size="sm" className="h-8">
                  <Plus className="w-4 h-4 mr-2" />
                  Νέο Ακίνητο
                </Button>
              </div>
            </div>
             <Collapsible className="mt-4">
                <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-start p-4 text-sm font-semibold">
                    <Filter className="w-4 h-4 mr-2"/>
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
