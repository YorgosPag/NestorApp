import type { Property } from '@/types/property-viewer';
import type { PropertyStats } from '@/types/property';

export type ReadOnlyPropertyViewerLayoutProps = {
  isLoading: boolean;
  viewMode: 'list' | 'grid';
  showDashboard: boolean;
  stats: PropertyStats;
  filteredProperties: Property[];
  selectedPropertyIds: string[];
  hoveredPropertyId: string | null;
  handlePolygonSelect: (propertyId: string, isShiftClick: boolean) => void;
  onSelectFloor: (floorId: string | null) => void;
  handleUpdateProperty: (propertyId: string, updates: Partial<Property>) => void;
  // catch-all (ό,τι περνάει στο viewer)
  [key: string]: any;
};

export type ReadOnlyViewerProps = {
  // όλα όσα περνιούνται στο FloorPlanViewer (passthrough),
  // αλλά με no-op για editing APIs και isReadOnly:true
  [key: string]: any;
};
