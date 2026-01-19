// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import React from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PropertyList } from '@/components/property-viewer/PropertyList';
import { PropertyDetailsPanel } from '@/components/property-viewer/PropertyDetailsPanel';
import { PropertyHoverInfo } from '@/components/property-viewer/PropertyHoverInfo';
import { useTranslation } from 'react-i18next';

/** Property data structure for list layout */
interface PropertyData {
  id: string;
  name?: string;
  [key: string]: unknown;
}

/** Viewer props interface */
interface ViewerPropsType {
  onSelectFloor?: (floorId: string) => void;
  properties?: PropertyData[];
  [key: string]: unknown;
}

export function ListLayout({
  isLoading,
  filteredProperties,
  selectedPropertyIds,
  handlePolygonSelect,
  hoveredPropertyId,
  readOnlyViewerProps,
  viewerProps,
}: {
  isLoading: boolean;
  filteredProperties: PropertyData[];
  selectedPropertyIds: string[];
  handlePolygonSelect: (id: string, isShiftClick: boolean) => void;
  hoveredPropertyId: string | null;
  readOnlyViewerProps: ViewerPropsType;
  viewerProps: ViewerPropsType;
) {
  const { t } = useTranslation('properties');
  // This component is updated to reflect the new layout
  return (
    <div className="flex-1 flex gap-4 min-h-0">
      {/* Property List (Left Panel) */}
      <div className="w-[320px] shrink-0 flex flex-col gap-4">
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="pb-4 shrink-0">
            <CardTitle className="text-base">{t('viewer.availableProperties')}</CardTitle>
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
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="py-3 px-4 shrink-0">
            <CardTitle className="text-sm">{t('viewer.propertyDetails')}</CardTitle>
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
            <CardTitle className="text-sm">{t('viewer.propertyInfo')}</CardTitle>
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
  );
}
