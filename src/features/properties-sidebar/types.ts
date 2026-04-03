'use client';

import type { Property } from '@/types/property-viewer';

export interface FloorData {
  id: string;
  name: string;
  level: number;
  buildingId: string;
  properties: Property[];
}

/** Canonical viewer capabilities required by the properties sidebar. */
export interface ViewerPassthroughProps {
  properties: Property[];
  selectedFloorId?: string | null;
  onSelectFloor?: (floorId: string | null) => void;
  selectedPropertyIds?: string[];
  hoveredPropertyId?: string | null;
  handleUpdateProperty?: (propertyId: string, updates: Partial<Property>) => Promise<void>;
}

export interface ViewerPassthroughPropsWithFloors extends ViewerPassthroughProps {
  floors: FloorData[];
  currentFloor: FloorData | null;
  handleUpdateProperty: (propertyId: string, updates: Partial<Property>) => Promise<void>;
}

export interface PropertiesSidebarProps {
  units: Property[];
  selectedProperty: Property | null;
  viewerProps: ViewerPassthroughProps;
  setShowHistoryPanel: (show: boolean) => void;
  floors: FloorData[];
  onSelectProperty: (id: string, isShift: boolean) => void;
  selectedPropertyIds: string[];
  onAssignmentSuccess: () => void;
  /** Callback to start inline property creation */
  onNewProperty?: () => void;
  /** Callback to delete the selected property */
  onDeleteProperty?: (propertyId: string) => Promise<void>;
  /** Whether we are in "create new property" mode (inline form) */
  isCreatingNewUnit?: boolean;
  /** Callback when a new property is successfully created */
  onPropertyCreated?: (propertyId: string) => void;
  /** Callback to cancel new property creation */
  onCancelCreate?: () => void;
  /** Default tab to open (from URL query param) */
  defaultTab?: string;
}
