import type { Property } from '@/types/property-viewer';
import type { PropertyStats } from '@/types/property';

/**
 * 🏢 ENTERPRISE: Explicit read-only viewer capabilities.
 * The read-only surface only needs property data plus floor navigation.
 */
export type ReadOnlyViewerContextProps = {
  properties?: Property[];
  onSelectFloor: (floorId: string | null) => void;
};

export type ReadOnlyPropertyViewerLayoutProps = {
  isLoading: boolean;
  viewMode: 'list' | 'grid';
  showDashboard: boolean;
  stats: PropertyStats;
  filteredProperties: Property[];
  selectedPropertyIds: string[];
  hoveredPropertyId: string | null;
  /** SPEC-237C: Hover callback for bidirectional sync */
  onHoverProperty?: (propertyId: string | null) => void;
  handlePolygonSelect: (id: string | null) => void;
  onSelectFloor: (floorId: string | null) => void;
  handleUpdateProperty?: (propertyId: string, updates: Partial<Property>) => void;
  properties?: Property[];
};
