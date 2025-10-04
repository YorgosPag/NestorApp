'use client';

import type { Property } from '@/types/property-viewer';

export interface FloorData {
  id: string;
  name: string;
  level: number;
  buildingId: string;
  properties: Property[];
}

export interface UnitsSidebarProps {
  units: Property[];
  selectedUnit: Property | null;
  viewerProps: any;
  setShowHistoryPanel: (show: boolean) => void;
  floors: FloorData[];
  onSelectUnit: (id: string, isShift: boolean) => void;
  selectedUnitIds: string[];
  onAssignmentSuccess: () => void;
}
