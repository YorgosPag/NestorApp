import type { Property } from '@/types/property-viewer';
import type { PropertyStats } from '@/types/property';

/**
 * 🏢 ENTERPRISE: Props for ReadOnlyPropertyViewerLayout
 *
 * NOTE: Index signature uses 'unknown' as catch-all for viewer props passthrough.
 * This allows flexibility while maintaining type safety.
 * See: https://github.com/microsoft/TypeScript/issues/17867
 */
export type ReadOnlyPropertyViewerLayoutProps = {
  isLoading: boolean;
  viewMode: 'list' | 'grid';
  showDashboard: boolean;
  stats: PropertyStats;
  filteredProperties: Property[];
  selectedPropertyIds: string[];
  hoveredPropertyId: string | null;
  handlePolygonSelect: (id: string | null) => void;
  onSelectFloor: (floorId: string | null) => void;
  handleUpdateProperty: (propertyId: string, updates: Partial<Property>) => void;
  properties?: Property[];
  // catch-all for viewer props passthrough (required due to rest spread pattern)
  [key: string]: unknown;
};

/**
 * 🏢 ENTERPRISE: Props for read-only viewer component
 *
 * NOTE: Index signature for viewer passthrough props.
 * Future work should enumerate all props for full type safety.
 */
export type ReadOnlyViewerProps = {
  [key: string]: unknown;
};
