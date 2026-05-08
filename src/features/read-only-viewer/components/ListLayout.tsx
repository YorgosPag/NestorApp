// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PropertyList } from '@/components/property-viewer/PropertyList';
import { PropertyDetailsPanel } from '@/components/property-viewer/PropertyDetailsPanel';
import { PropertyHoverInfo } from '@/components/property-viewer/PropertyHoverInfo';
import { PropertyStatusLegend } from '@/components/property-viewer/PropertyStatusLegend';
import { ReadOnlyMediaViewer, MEDIA_TAB_PARAM, parseMediaTabParam } from './ReadOnlyMediaViewer';
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import type { Property } from '@/types/property-viewer';
import type { ReadOnlyViewerContextProps } from '../types';
import '@/lib/design-system';
import { formatCurrency } from '@/lib/intl-formatting';
import type { OverlayLabel } from '@/components/shared/files/media/overlay-polygon-renderer';
import { PROPERTY_STATUS_LABELS } from '@/constants/domains/property-status-core';
import type { PropertyStatus } from '@/constants/domains/property-status-core';
import { getEffectivePrice } from '@/lib/properties/price-resolver';

export function ListLayout({
  isLoading,
  filteredProperties,
  selectedPropertyIds,
  handlePolygonSelect,
  hoveredPropertyId,
  onHoverProperty,
  viewerProps,
}: {
  isLoading: boolean;
  filteredProperties: Property[];
  selectedPropertyIds: string[];
  handlePolygonSelect: (id: string, isShiftClick: boolean) => void;
  hoveredPropertyId: string | null;
  /** SPEC-237C: Hover callback for bidirectional sync */
  onHoverProperty?: (propertyId: string | null) => void;
  viewerProps: ReadOnlyViewerContextProps;
}) {
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
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
  // 🏢 ADR-258D: PropertyHoverInfo visible ONLY on floor floorplan tabs
  // Unit floorplan (Κάτοψη Μονάδας) → δεν έχει overlay polygons, δεν χρειάζεται hover info
  // Floor floorplan (Κάτοψη Ορόφου) → έχει overlay polygons, χρειάζεται hover info
  const showPropertyHoverInfo = activeMediaTab === 'floorplan-floor'
    || activeMediaTab.startsWith('floorplan-floor-');
  const properties = viewerProps.properties ?? [];

  // ADR-340 §3.6 — pre-formatted in-polygon hover labels for FloorplanGallery.
  // Locale-agnostic strings: caller formats with i18n + currency, the canvas
  // renderer just draws them. Three lines per property: code (small),
  // gross sqm (small), sale price (emphasis / larger).
  const sqmUnit = t('units.sqm', { ns: 'properties-enums' });
  const propertyLabels = React.useMemo(() => {
    const map = new Map<string, OverlayLabel>();
    for (const p of properties) {
      const grossSqm = p.areas?.gross ?? p.area;
      const hasSqm = typeof grossSqm === 'number' && Number.isFinite(grossSqm);
      const effectivePrice = getEffectivePrice(p);
      const statusKey = (p.commercialStatus ?? p.status) as PropertyStatus | undefined;
      const statusI18nKey = statusKey ? PROPERTY_STATUS_LABELS[statusKey] : undefined;
      const statusText = statusI18nKey ? t(statusI18nKey).toUpperCase() : undefined;
      map.set(p.id, {
        statusText,
        primaryText: p.code || undefined,
        secondaryText: hasSqm ? `${grossSqm} ${sqmUnit}` : undefined,
        emphasisText: effectivePrice ? formatCurrency(effectivePrice.amount) : undefined,
      });
    }
    return map;
  }, [properties, sqmUnit, t]);

  const handleSelectFloor = React.useCallback(
    (floorId: string | null) => {
      viewerProps.onSelectFloor?.(floorId);
    },
    [viewerProps.onSelectFloor]
  );

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
                hoveredPropertyId={hoveredPropertyId}
                onHoverProperty={onHoverProperty}
              />
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Center Panel - ReadOnlyMediaViewer for floorplans/photos/videos */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">
        {showPropertyHoverInfo && (
          <PropertyStatusLegend
            properties={filteredProperties}
            className="absolute bottom-2 left-2 z-10"
          />
        )}
        <ReadOnlyMediaViewer
          propertyId={selectedPropertyIds[0] ?? null}
          propertyName={
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
          companyId={
            selectedPropertyIds[0]
              ? (() => {
                  const prop = filteredProperties.find((p) => p.id === selectedPropertyIds[0]) as Record<string, unknown> | undefined;
                  return (prop?.companyId as string | undefined) ?? (prop?.linkedCompanyId as string | undefined) ?? null;
                })()
              : null
          }
          levels={
            selectedPropertyIds[0]
              ? filteredProperties.find((p) => p.id === selectedPropertyIds[0])?.levels
              : undefined
          }
          onHoverOverlay={onHoverProperty}
          onClickOverlay={(propertyId) => handlePolygonSelect(propertyId, false)}
          highlightedOverlayUnitId={hoveredPropertyId}
          propertyLabels={propertyLabels}
        />
      </div>

      {/* Details Panel (Right Panel) - fixed width (360px for scrollbar clearance), aligned to right edge */}
      <div className={`w-[360px] shrink-0 flex flex-col ${layout.listGapResponsive}`}>
        {/* 🏢 ADR-258D: Επιλεγμένο Ακίνητο — equal height with Γρήγορη Προβολή */}
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className={`${spacing.padding.sm} shrink-0`}>
            <CardTitle className="text-sm">{t('viewer.propertyDetails')}</CardTitle>
          </CardHeader>
          {/* 🏢 ENTERPRISE: No padding - ScrollArea fills to edges (same pattern as Διαθέσιμα Ακίνητα) */}
          <CardContent className={`flex-1 ${spacing.padding.none} overflow-hidden`}>
            <PropertyDetailsPanel
              propertyIds={selectedPropertyIds}
              onSelectFloor={handleSelectFloor}
              properties={properties}
              isReadOnly
            />
          </CardContent>
        </Card>
        {/* 🏢 ENTERPRISE: Πληροφορίες Ακινήτου - Only visible on floorplan tab */}
        {/* Hidden on photos/videos tabs because there are no hoverable regions */}
        {showPropertyHoverInfo && (
          <Card className="flex-1 flex flex-col min-h-0">
            {/* 🏢 ADR-258D: Γρήγορη Προβολή — equal height with Επιλεγμένο Ακίνητο */}
            <CardHeader className={`${spacing.padding.sm} shrink-0`}>
              <CardTitle className="text-sm">{t('viewer.propertyInfo')}</CardTitle>
            </CardHeader>
            <CardContent className={`flex-1 ${spacing.padding.none} overflow-hidden`}>
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
