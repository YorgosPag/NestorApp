'use client';

import React from 'react';
import { FloorPlanViewer } from '@/components/property-viewer/FloorPlanViewer';
import { ViewerTools } from '@/components/property-viewer/ViewerTools';
import type { Property } from '@/types/property-viewer';
import '@/lib/design-system';

type ViewerMode = 'view' | 'create' | 'measure' | 'edit';

interface ViewerPassthroughProps {
  viewMode: ViewerMode;
  onViewModeChange: (mode: ViewerMode) => void;
  selectedPropertyId?: string | null;
  onPropertySelect?: (id: string | null) => void;
  isConnecting?: boolean;
  onConnectingChange?: (connecting: boolean) => void;
  onDuplicateSelected?: (propertyId: string) => Promise<void> | void;
  onDeleteSelected?: (propertyId: string) => Promise<void> | void;
  setShowHistoryPanel: (show: boolean) => void;
  [key: string]: unknown;
}

interface FloorPlanEditorProps extends ViewerPassthroughProps {
  filteredProperties: Property[];
}

export function FloorPlanEditor({ filteredProperties, ...viewerProps }: FloorPlanEditorProps) {
  const floorPlanViewMode = viewerProps.viewMode === 'measure' ? 'view' : viewerProps.viewMode;

  return (
    <div className="flex-1 flex flex-col gap-4 min-w-0">
      <ViewerTools
        {...viewerProps}
        onDuplicateSelected={viewerProps.onDuplicateSelected}
        onDeleteSelected={viewerProps.onDeleteSelected}
      />
      <FloorPlanViewer
        {...viewerProps}
        viewMode={floorPlanViewMode}
        properties={filteredProperties}
      />
    </div>
  );
}
