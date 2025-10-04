'use client';

import React from 'react';
import type { ReadOnlyPropertyViewerLayoutProps } from './types';
import { PropertyDashboard } from '@/components/property-management/PropertyDashboard';
import { ListLayout } from './components/ListLayout';
import { GridLayout } from './components/GridLayout';
import { buildReadOnlyViewerProps } from './utils/buildReadOnlyViewerProps';
import { PropertyList } from '@/components/property-viewer/PropertyList';
import { PropertyDetailsPanel } from '@/components/property-viewer/PropertyDetailsPanel';
import { PropertyHoverInfo } from '@/components/property-viewer/PropertyHoverInfo';
import { FloorPlanViewer } from '@/components/property-viewer/FloorPlanViewer';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export function ReadOnlyPropertyViewerLayout({
  isLoading,
  viewMode,
  showDashboard,
  stats,
  filteredProperties,
  selectedPropertyIds,
  hoveredPropertyId,
  handlePolygonSelect,
  onSelectFloor,
  handleUpdateProperty,
  ...viewerProps
}: ReadOnlyPropertyViewerLayoutProps) {
  const readOnlyViewerProps = buildReadOnlyViewerProps(viewerProps);

  return (
    <>
      {showDashboard && <div className="shrink-0 px-4"><PropertyDashboard stats={stats} /></div>}

      <main className="flex-1 flex overflow-hidden gap-4 px-4 pb-4">
        {viewMode === 'list' ? (
          <div className="flex-1 flex gap-4 min-h-0">
            {/* Property List (Left Panel) */}
            <div className="w-[320px] shrink-0 flex flex-col gap-4">
              <Card className="flex-1 flex flex-col min-h-0">
                <CardHeader className="pb-4 shrink-0">
                  <CardTitle className="text-base">Διαθέσιμα Ακίνητα</CardTitle>
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

            {/* Details Panel (Right Panel) */}
            <div className="w-[320px] shrink-0 flex flex-col gap-4">
              <Card className="flex-1 flex flex-col min-h-0">
                <CardHeader className="py-3 px-4 shrink-0">
                  <CardTitle className="text-sm">Λεπτομέρειες Ακινήτου</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 flex-1 min-h-0">
                  <PropertyDetailsPanel
                    propertyIds={selectedPropertyIds}
                    onSelectFloor={viewerProps.onSelectFloor}
                    properties={viewerProps.properties}
                    onUpdateProperty={() => {}}
                    isReadOnly={true}
                  />
                </CardContent>
              </Card>
              <Card className="h-[280px] shrink-0">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">Πληροφορίες Ακινήτου</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 h-full">
                  <PropertyHoverInfo
                    propertyId={hoveredPropertyId}
                    properties={filteredProperties}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <GridLayout
            filteredProperties={filteredProperties}
            handlePolygonSelect={handlePolygonSelect}
            selectedPropertyIds={selectedPropertyIds}
          />
        )}
      </main>
    </>
  );
}
