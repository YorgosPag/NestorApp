'use client';

/**
 * 🔍 PropertyPageFilters
 *
 * Desktop + mobile variants of the advanced filters panel for the properties
 * page. Extracted so `UnitsPageContent` stays under the Google 500-line limit
 * (N.7.1) and the responsive split lives in one place.
 *
 * @module components/properties/page/PropertyPageFilters
 */

import { AdvancedFiltersPanel, type UnitFilterState } from '@/components/core/AdvancedFilters';
import type { FilterPanelConfig } from '@/components/core/AdvancedFilters/types';

interface PropertyPageFiltersProps {
  config: FilterPanelConfig;
  filters: UnitFilterState;
  onFiltersChange: (next: UnitFilterState) => void;
  showMobile: boolean;
}

export function PropertyPageFilters({
  config,
  filters,
  onFiltersChange,
  showMobile,
}: PropertyPageFiltersProps) {
  return (
    <>
      <div className="hidden md:block -mt-1">
        <AdvancedFiltersPanel
          config={config}
          filters={filters}
          onFiltersChange={onFiltersChange}
        />
      </div>
      {showMobile && (
        <div className="md:hidden"> {/* eslint-disable-line custom/no-hardcoded-strings */}
          <AdvancedFiltersPanel
            config={config}
            filters={filters}
            onFiltersChange={onFiltersChange}
            defaultOpen
          />
        </div>
      )}
    </>
  );
}
