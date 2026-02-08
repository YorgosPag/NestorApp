// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PropertyList } from '@/components/property-viewer/PropertyList';
import { PropertyDetailsPanel } from '@/components/property-viewer/PropertyDetailsPanel';
import { PropertyHoverInfo } from '@/components/property-viewer/PropertyHoverInfo';
import { ReadOnlyMediaViewer, MEDIA_TAB_PARAM, parseMediaTabParam } from './ReadOnlyMediaViewer';
import { useTranslation } from 'react-i18next';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import type { Property } from '@/types/property-viewer';

/** Viewer props interface */
interface ViewerPropsType {
  onSelectFloor?: (floorId: string | null) => void;
  properties?: Property[];
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
  filteredProperties: Property[];
  selectedPropertyIds: string[];
  handlePolygonSelect: (id: string, isShiftClick: boolean) => void;
  hoveredPropertyId: string | null;
  readOnlyViewerProps: ViewerPropsType;
  viewerProps: ViewerPropsType;
}) {
  const { t } = useTranslation('properties');
  // 🏢 ENTERPRISE: Centralized spacing tokens - NO hardcoded values
  const layout = useLayoutClasses();
  const spacing = useSpacingTokens();

  // ==========================================================================
  // 🏢 ENTERPRISE: URL-Based State for PropertyHoverInfo visibility
  // ==========================================================================
  // PropertyHoverInfo is only relevant for floorplan tab (has polygons to hover).
  // Photos/Videos tabs don't have hoverable regions, so hide the info panel.
  const searchParams = useSearchParams();
  const activeMediaTab = parseMediaTabParam(searchParams.get(MEDIA_TAB_PARAM));
  const showPropertyHoverInfo = activeMediaTab === 'floorplans';

  return (
    // 🏢 ENTERPRISE: gap-2 (8px) from centralized tokens
    <div className={`flex-1 flex ${layout.listGapResponsive} min-h-0`}>
      {/* Property List (Left Panel) - fixed 360px width (same as right panel) */}
      <div className={`w-[360px] shrink-0 flex flex-col ${layout.listGapResponsive}`}>
        <Card className="flex-1 flex flex-col min-h-0">
          {/* 🏢 ENTERPRISE: 8px padding from centralized tokens */}
          <CardHeader className={`${spacing.padding.sm} shrink-0`}>
            <CardTitle className="text-base">{t('viewer.availableProperties')}</CardTitle>
          </CardHeader>
          {/* 🏢 ENTERPRISE: No padding - list items handle their own spacing */}
          <CardContent className={`flex-1 ${spacing.padding.none} overflow-hidden`}>
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

      {/* Center Panel - ReadOnlyMediaViewer for floorplans/photos/videos */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <ReadOnlyMediaViewer
          unitId={selectedPropertyIds[0] ?? null}
          unitName={
            selectedPropertyIds[0]
              ? filteredProperties.find((p) => p.id === selectedPropertyIds[0])?.name
              : undefined
          }
          floorId={
            selectedPropertyIds[0]
              ? filteredProperties.find((p) => p.id === selectedPropertyIds[0])?.floorId ?? null
              : null
          }
          buildingId={
            selectedPropertyIds[0]
              ? filteredProperties.find((p) => p.id === selectedPropertyIds[0])?.buildingId ?? null
              : null
          }
          floorNumber={
            selectedPropertyIds[0]
              ? filteredProperties.find((p) => p.id === selectedPropertyIds[0])?.floor ?? null
              : null
          }
        />
      </div>

      {/* Details Panel (Right Panel) - fixed width (360px for scrollbar clearance), aligned to right edge */}
      <div className={`w-[360px] shrink-0 flex flex-col ${layout.listGapResponsive}`}>
        {/* 🏢 ENTERPRISE: Λεπτομέρειες Ακινήτου */}
        <Card className="flex-1 flex flex-col min-h-0">
          {/* 🏢 ENTERPRISE: 8px padding from centralized tokens */}
          <CardHeader className={`${spacing.padding.sm} shrink-0`}>
            <CardTitle className="text-sm">{t('viewer.propertyDetails')}</CardTitle>
          </CardHeader>
          {/* 🏢 ENTERPRISE: No padding - ScrollArea fills to edges (same pattern as Διαθέσιμα Ακίνητα) */}
          <CardContent className={`flex-1 ${spacing.padding.none} overflow-hidden`}>
            <PropertyDetailsPanel
              propertyIds={selectedPropertyIds}
              onSelectFloor={viewerProps.onSelectFloor}
              properties={viewerProps.properties}
              onUpdateProperty={() => {}}
              isReadOnly={true}
            />
          </CardContent>
        </Card>
        {/* 🏢 ENTERPRISE: Πληροφορίες Ακινήτου - Only visible on floorplan tab */}
        {/* Hidden on photos/videos tabs because there are no hoverable regions */}
        {showPropertyHoverInfo && (
          <Card className="h-[280px] shrink-0">
            {/* 🏢 ENTERPRISE: 8px padding from centralized tokens */}
            <CardHeader className={spacing.padding.sm}>
              <CardTitle className="text-sm">{t('viewer.propertyInfo')}</CardTitle>
            </CardHeader>
            {/* 🏢 ENTERPRISE: No padding - content handles internal padding (same pattern) */}
            <CardContent className={`${spacing.padding.none} h-full`}>
              <PropertyHoverInfo
                propertyId={hoveredPropertyId}
                properties={filteredProperties}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
