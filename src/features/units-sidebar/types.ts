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
  /** Callback to start inline new unit creation */
  onNewUnit?: () => void;
  /** Callback to delete the selected unit */
  onDeleteUnit?: (unitId: string) => void;
  /** Whether we are in "create new unit" mode (inline form) */
  isCreatingNewUnit?: boolean;
  /** Callback when new unit is successfully created */
  onUnitCreated?: (unitId: string) => void;
  /** Callback to cancel new unit creation */
  onCancelCreate?: () => void;
  /** Default tab to open (from URL query param) */
  defaultTab?: string;
}
