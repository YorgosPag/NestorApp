'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { usePublicPropertyViewer } from '@/hooks/usePublicPropertyViewer';
import { PublicPropertyViewerHeader } from './page/PublicPropertyViewerHeader';
import { ReadOnlyPropertyViewerLayout } from '@/features/read-only-viewer';

import { useUrlPreselect } from '@/features/property-management/hooks/useUrlPreselect';
import { useViewerProps } from '@/features/property-management/hooks/useViewerProps';

export function PropertyManagementPageContent() {
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('selected');

  // Hook (παραμένει ο ίδιος — δεν αλλάζουμε API/flows)
  const hookState = usePublicPropertyViewer();

  // ΑΚΡΙΒΩΣ η ίδια συμπεριφορά preselect με το αρχικό effect
  useUrlPreselect({
    selectedId,
    properties: hookState.properties,
    onSelectFloor: hookState.onSelectFloor,
    setSelectedProperties: hookState.setSelectedProperties,
  });

  // Viewer props builder (ίδιες τιμές, ίδια διάταξη)
  const viewerProps = useViewerProps(hookState);

  // === RENDER (ΑΠΑΡΑΛΛΑΚΤΟ DOM/Tailwind/labels/flows) ===
  return (
    <div className="h-full flex flex-col bg-muted/30">
      {/* NEW: Customer-focused header instead of admin header */}
      <PublicPropertyViewerHeader
        viewMode={hookState.viewMode}
        setViewMode={hookState.setViewMode}
        filters={hookState.filters}
        onFiltersChange={hookState.handleFiltersChange}
        availableCount={hookState.filteredProperties.length}
      />

      {/* Updated layout: NO dashboard, more space for properties */}
      <ReadOnlyPropertyViewerLayout
        {...viewerProps}
        isLoading={hookState.isLoading}
        viewMode={hookState.viewMode}
        showDashboard={false}
        stats={hookState.dashboardStats}
        filteredProperties={hookState.filteredProperties}
        handleUpdateProperty={() => {}}
      />
      {/* No VersionHistoryPanel for public view */}
    </div>
  );
}
