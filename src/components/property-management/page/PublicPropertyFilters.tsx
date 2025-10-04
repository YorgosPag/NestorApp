'use client';

// This component has been refactored and moved to its own directory
// under src/components/public-property-filters/
// This file is now obsolete and can be safely deleted in the future.

import { PublicPropertyFilters as NewPublicPropertyFilters } from '@/components/public-property-filters';
import type { FilterState } from '@/types/property-viewer';

interface PublicPropertyFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export function PublicPropertyFilters(props: PublicPropertyFiltersProps) {
  return <NewPublicPropertyFilters {...props} />;
}
