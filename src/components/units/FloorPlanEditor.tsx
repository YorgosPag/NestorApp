
'use client';

import React from 'react';
import { FloorPlanViewer } from '@/components/property-viewer/FloorPlanViewer';
import { ViewerTools } from '@/components/property-viewer/ViewerTools';
import type { Property } from '@/types/property-viewer';

/** Viewer props that can be passed through */
interface ViewerPassthroughProps {
  viewMode?: string;
  onViewModeChange?: (mode: string) => void;
  selectedPropertyId?: string | null;
  onPropertySelect?: (id: string | null) => void;
  isConnecting?: boolean;
  onConnectingChange?: (connecting: boolean) => void;
  setShowHistoryPanel: (show: boolean) => void;
  [key: string]: unknown;
}

interface FloorPlanEditorProps extends ViewerPassthroughProps {
  filteredProperties: Property[];
}

export function FloorPlanEditor({ filteredProperties, ...viewerProps }: FloorPlanEditorProps) {
  return (
    <div className="flex-1 flex flex-col gap-4 min-w-0">
      <ViewerTools {...viewerProps} onShowHistory={() => viewerProps.setShowHistoryPanel(true)} />
      <FloorPlanViewer
        {...viewerProps}
        properties={filteredProperties}
      />
    </div>
  );
}
