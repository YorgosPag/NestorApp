// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
// 🏢 ENTERPRISE: Refactored to use centralized ListLayout component - NO duplicate code
'use client';

import React from 'react';
import type { ReadOnlyPropertyViewerLayoutProps } from './types';
import { PropertyDashboard } from '@/components/property-management/PropertyDashboard';
import { ListLayout } from './components/ListLayout';
import { GridLayout } from './components/GridLayout';
import { buildReadOnlyViewerProps } from './utils/buildReadOnlyViewerProps';
// 🏢 ENTERPRISE: Centralized layout spacing tokens
import { useLayoutClasses } from '@/hooks/useLayoutClasses';

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
  const layout = useLayoutClasses();
  const readOnlyViewerProps = buildReadOnlyViewerProps(viewerProps);

  return (
    <>
      {showDashboard && <div className="shrink-0 px-4"><PropertyDashboard stats={stats} /></div>}

      {/* 🏢 ENTERPRISE: Centralized spacing - gap-2 (8px), px-2 py-2 padding */}
      <div className={`flex-1 flex overflow-hidden ${layout.listGapResponsive} ${layout.listPaddingResponsive}`}>
        {viewMode === 'list' ? (
          // 🏢 ENTERPRISE: Using centralized ListLayout component - NO duplicate code
          <ListLayout
            isLoading={isLoading}
            filteredProperties={filteredProperties}
            selectedPropertyIds={selectedPropertyIds}
            handlePolygonSelect={handlePolygonSelect}
            hoveredPropertyId={hoveredPropertyId}
            readOnlyViewerProps={readOnlyViewerProps}
            viewerProps={{
              ...viewerProps,
              onSelectFloor,
              properties: viewerProps.properties,
            }}
          />
        ) : (
          <GridLayout
            filteredProperties={filteredProperties}
            handlePolygonSelect={handlePolygonSelect}
            selectedPropertyIds={selectedPropertyIds}
          />
        )}
      </div>
    </>
  );
}
