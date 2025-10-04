'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Home } from 'lucide-react';

import { UnitsList } from '@/components/units/UnitsList';
import { PropertyDetailsContent } from '@/components/property-viewer/details/PropertyDetailsContent';
import PhotosTabContent from '@/components/building-management/tabs/PhotosTabContent';
import VideosTabContent from '@/components/building-management/tabs/VideosTabContent';

import { useUnitsSidebar } from './hooks/useUnitsSidebar';
import { UnitDetailsHeader } from './components/UnitDetailsHeader';
import { FloorPlanTab } from './components/FloorPlanTab';
import type { UnitsSidebarProps } from './types';

export function UnitsSidebar({
  units,
  selectedUnit,
  viewerProps,
  setShowHistoryPanel,
  floors = [],
  onSelectUnit,
  selectedUnitIds,
  onAssignmentSuccess,
}: UnitsSidebarProps) {
  const {
    safeFloors,
    currentFloor,
    safeViewerPropsWithFloors,
    safeViewerProps,
  } = useUnitsSidebar(floors, viewerProps);

  return (
    <div className="flex-1 flex gap-4 min-h-0">
      <UnitsList
        units={units}
        selectedUnitIds={selectedUnitIds}
        onSelectUnit={onSelectUnit}
        onAssignmentSuccess={onAssignmentSuccess}
      />

      <div className="flex-1 flex flex-col min-h-0 bg-card border rounded-lg shadow-sm">
        <UnitDetailsHeader unit={selectedUnit} />

        <Tabs defaultValue="info" className="flex-1 flex flex-col min-h-0">
          <div className="shrink-0 border-b px-4">
            <TabsList>
              <TabsTrigger value="info">Βασικές Πληροφορίες</TabsTrigger>
              <TabsTrigger value="floor-plan">Κάτοψη</TabsTrigger>
              <TabsTrigger value="documents">Έγγραφα</TabsTrigger>
              <TabsTrigger value="photos">Φωτογραφίες</TabsTrigger>
              <TabsTrigger value="videos">Videos</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="info" className="flex-1 overflow-y-auto">
            <ScrollArea className="h-full p-4">
              {selectedUnit ? (
                <PropertyDetailsContent
                  property={selectedUnit}
                  onSelectFloor={safeViewerPropsWithFloors.onSelectFloor || (() => {})}
                  onUpdateProperty={safeViewerPropsWithFloors.handleUpdateProperty || (() => {})}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <Home className="h-12 w-12 mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">Επιλέξτε μια μονάδα</h3>
                  <p className="text-sm">Επιλέξτε μια μονάδα από τη λίστα αριστερά για να δείτε τις πληροφορίες της.</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="floor-plan" className="flex-1 flex flex-col min-h-0 m-0 p-0">
            <FloorPlanTab
                selectedUnit={selectedUnit}
                currentFloor={currentFloor}
                safeFloors={safeFloors}
                safeViewerProps={safeViewerProps}
                safeViewerPropsWithFloors={safeViewerPropsWithFloors}
                setShowHistoryPanel={setShowHistoryPanel}
                units={units}
            />
          </TabsContent>

          <TabsContent value="documents" className="p-4">
            <div className="text-center text-muted-foreground">
              <p>Έγγραφα - Coming Soon</p>
              <p className="text-xs mt-2">Εδώ θα εμφανίζονται τα έγγραφα της μονάδας</p>
            </div>
          </TabsContent>
          
          <TabsContent value="photos" className="p-4">
            <PhotosTabContent />
          </TabsContent>
          
          <TabsContent value="videos" className="p-4">
            <VideosTabContent />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
