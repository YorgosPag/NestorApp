import type { Property } from '@/types/property-viewer';

/**
 * 🏢 ENTERPRISE: Explicit read-only viewer capabilities.
 * The read-only surface only needs property data plus floor navigation.
 */
export type ReadOnlyViewerContextProps = {
  properties?: Property[];
  onSelectFloor: (floorId: string | null) => void;
};
