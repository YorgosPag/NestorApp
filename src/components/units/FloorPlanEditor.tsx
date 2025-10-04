
'use client';

import React from 'react';
import { FloorPlanViewer } from '@/components/property-viewer/FloorPlanViewer';
import { ViewerTools } from '@/components/property-viewer/ViewerTools';
import type { Property } from '@/types/property-viewer';

interface FloorPlanEditorProps {
  filteredProperties: Property[];
  [key: string]: any; // Accept all other viewer props
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
