'use client';

import React from 'react';
import type { Property } from '@/types/property-viewer';
import type { PropertyStats } from '@/types/property';
import { PropertyList } from '../property-viewer/PropertyList';
import { PropertyDetailsPanel } from '../property-viewer/PropertyDetailsPanel';
import { PropertyHoverInfo } from '../property-viewer/PropertyHoverInfo';
import { FloorPlanViewer } from '../property-viewer/FloorPlanViewer';
import { PropertyGrid } from '../property-viewer/PropertyGrid';
import { PropertyDashboard } from './PropertyDashboard';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PropertyViewerLayoutProps {
  isLoading: boolean;
  viewMode: 'list' | 'grid';
  showDashboard: boolean;
  stats: PropertyStats;
  filteredProperties: Property[];
  selectedPropertyIds: string[];
  handlePolygonSelect: (propertyId: string, isShiftClick: boolean) => void;
  onSelectFloor: (floorId: string | null) => void;
  handleUpdateProperty: (propertyId: string, updates: Partial<Property>) => void;
  [key: string]: any; // Catch-all for other props
}

export function PropertyViewerLayout({
  isLoading,
  viewMode,
  showDashboard,
  stats,
  filteredProperties,
  selectedPropertyIds,
  handlePolygonSelect,
  onSelectFloor,
  handleUpdateProperty,
  ...viewerProps
}: PropertyViewerLayoutProps) {

  return (
    <>
      {showDashboard && <div className="shrink-0 px-4"><PropertyDashboard stats={stats} /></div>}
      
      <main className="flex-1 flex overflow-hidden gap-4 px-4 pb-4">
        {viewMode === 'list' ? (
          <div className="flex-1 flex gap-4 min-h-0">
            <div className="w-[320px] shrink-0 flex flex-col gap-4">
              <Card className="flex-1 flex flex-col min-h-0">
                <CardHeader className="pb-4 shrink-0">
                  <CardTitle className="text-base">Λίστα Ακινήτων</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-0 overflow-hidden">
                  <ScrollArea className="h-full">
                    <PropertyList
                      properties={filteredProperties}
                      selectedPropertyIds={selectedPropertyIds}
                      onSelectProperty={handlePolygonSelect}
                      isLoading={isLoading}
                    />
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <div className="flex-1 flex flex-col gap-4 min-w-0">
              <FloorPlanViewer {...viewerProps} properties={filteredProperties} onSelectProperty={handlePolygonSelect} />
            </div>
            
            <div className="w-[320px] shrink-0 flex flex-col gap-4">
              <Card className="flex-1 flex flex-col min-h-0">
                <CardHeader className="py-3 px-4 shrink-0">
                  <CardTitle className="text-sm">Λεπτομέρειες Ακινήτου</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 flex-1 min-h-0">
                  <PropertyDetailsPanel 
                    propertyIds={selectedPropertyIds} 
                    onSelectFloor={onSelectFloor}
                    properties={viewerProps.properties}
                    onUpdateProperty={handleUpdateProperty}
                  />
                </CardContent>
              </Card>
              <Card className="h-[280px] shrink-0">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">Γρήγορες Πληροφορίες</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 h-full">
                  <PropertyHoverInfo propertyId={viewerProps.hoveredPropertyId} properties={viewerProps.properties} />
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <PropertyGrid 
            properties={filteredProperties}
            onSelect={handlePolygonSelect}
            selectedPropertyIds={selectedPropertyIds}
          />
        )}
      </main>
    </>
  );
}
