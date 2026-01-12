'use client';

import type { Property } from '@/types/property-viewer';

export interface FloorData {
  id: string;
  name: string;
  level: number;
  buildingId: string;
  properties: Property[];
}

/** Viewer props passed to the sidebar */
export interface ViewerPassthroughProps {
  selectedFloorId?: string | null;
  onSelectFloor?: (floorId: string | null) => void;
  selectedPropertyIds?: string[];
  hoveredPropertyId?: string | null;
  [key: string]: unknown;
}

export interface UnitsSidebarProps {
  units: Property[];
  selectedUnit: Property | null;
  viewerProps: ViewerPassthroughProps;
  setShowHistoryPanel: (show: boolean) => void;
  floors: FloorData[];
  onSelectUnit: (id: string, isShift: boolean) => void;
  selectedUnitIds: string[];
  onAssignmentSuccess: () => void;
}
