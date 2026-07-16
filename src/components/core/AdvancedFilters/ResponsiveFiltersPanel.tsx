'use client';

/**
 * 🔍 ResponsiveFiltersPanel — SSoT για το desktop/mobile split των φίλτρων
 *
 * Ο ίδιος `AdvancedFiltersPanel` αποδίδεται δύο φορές: μόνιμα στο desktop και,
 * πίσω από το κουμπί φίλτρων του header, ανοιχτός στο mobile. Το μοτίβο ήταν
 * αντιγραμμένο αυτούσιο στις 4 σελίδες πωλήσεων και στο `PropertyPageFilters`
 * — δεν έχει τίποτα ειδικό ανά domain, γι' αυτό ζει δίπλα στο panel που τυλίγει.
 *
 * @see AdvancedFiltersPanel.tsx — το panel· εδώ ζει ΜΟΝΟ το responsive split
 * @see docs/centralized-systems/reference/adrs/ADR-197-sales-pages-implementation-plan.md
 */

import { AdvancedFiltersPanel } from './AdvancedFiltersPanel';
import type { FilterPanelConfig, GenericFilterState } from './types';

interface ResponsiveFiltersPanelProps<T extends GenericFilterState> {
  config: FilterPanelConfig;
  filters: T;
  onFiltersChange: (filters: T) => void;
  /** Το mobile panel αποδίδεται μόνο όταν ο χρήστης πατήσει το κουμπί φίλτρων. */
  showMobile: boolean;
}

export function ResponsiveFiltersPanel<T extends GenericFilterState>({
  config,
  filters,
  onFiltersChange,
  showMobile,
}: ResponsiveFiltersPanelProps<T>) {
  return (
    <>
      <div className="hidden md:block -mt-1">
        <AdvancedFiltersPanel config={config} filters={filters} onFiltersChange={onFiltersChange} />
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
