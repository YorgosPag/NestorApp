'use client';

/**
 * @fileoverview Sales Dual-Row Quick Filters — ADR-197 §2.10
 * @description Two rows of quick filters: Row 1 = Commercial Status, Row 2 = Unit Type
 * @pattern Salesforce/HubSpot dual segmentation — AND logic between rows
 */

import React from 'react';
import {
  LayoutGrid,
  ShoppingBag,
  UserCheck,
  Key,
  BedSingle,
  Building2,
  Store,
  Briefcase,
} from 'lucide-react';
import { TypeQuickFilters } from '@/components/shared/TypeQuickFilters';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TypeFilterOption } from '@/components/shared/TypeQuickFilters';
import '@/lib/design-system';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface SalesQuickFiltersProps {
  selectedCommercialStatus: string;
  onCommercialStatusChange: (status: string) => void;
  selectedPropertyType: string;
  onPropertyTypeChange: (type: string) => void;
  className?: string;
  /**
   * When `true`, the commercial-status row is not rendered.
   * Useful for scoped pages (e.g. /sales/sold) where all items share the same
   * status and a status filter is degenerate.
   */
  hideCommercialStatus?: boolean;
}

// =============================================================================
// 🏢 OPTIONS (ADR-197 §2.10)
// =============================================================================

const COMMERCIAL_STATUS_OPTIONS: TypeFilterOption[] = [
  { value: 'all',              label: 'sales.quickFilters.allStatuses',     icon: LayoutGrid, tooltip: 'sales.quickFilters.allStatusesTooltip' },
  { value: 'for-sale',        label: 'sales.quickFilters.forSale',         icon: ShoppingBag, tooltip: 'sales.quickFilters.forSaleTooltip' },
  { value: 'reserved',        label: 'sales.quickFilters.reserved',        icon: UserCheck,   tooltip: 'sales.quickFilters.reservedTooltip' },
  { value: 'for-sale-and-rent', label: 'sales.quickFilters.dualListing',   icon: Key,         tooltip: 'sales.quickFilters.dualListingTooltip' },
];

const PROPERTY_TYPE_OPTIONS: TypeFilterOption[] = [
  { value: 'all',        label: 'filters.propertyTypes.all',        icon: LayoutGrid, tooltip: 'filters.propertyTypes.allTooltip' },
  { value: 'studio',     label: 'filters.propertyTypes.studio',     icon: BedSingle,  tooltip: 'filters.propertyTypes.studioTooltip' },
  { value: 'apartment',  label: 'filters.propertyTypes.apartment',  icon: Building2,  tooltip: 'filters.propertyTypes.apartmentTooltip' },
  { value: 'maisonette', label: 'filters.propertyTypes.maisonette', icon: Building2,  tooltip: 'filters.propertyTypes.maisonetteTooltip' },
  { value: 'shop',       label: 'filters.propertyTypes.shop',       icon: Store,      tooltip: 'filters.propertyTypes.shopTooltip' },
  { value: 'office',     label: 'filters.propertyTypes.office',     icon: Briefcase,  tooltip: 'filters.propertyTypes.officeTooltip' },
];

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function SalesQuickFilters({
  selectedCommercialStatus,
  onCommercialStatusChange,
  selectedPropertyType,
  onPropertyTypeChange,
  className,
  hideCommercialStatus = false,
}: SalesQuickFiltersProps) {
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);

  // Convert single selection to array format expected by TypeQuickFilters
  const handleStatusChange = (types: string[]) => {
    onCommercialStatusChange(types.length === 0 ? 'all' : types[0]);
  };

  const handleTypeChange = (types: string[]) => {
    onPropertyTypeChange(types.length === 0 ? 'all' : types[0]);
  };

  return (
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      {/* Row 1: Commercial Status */}
      {!hideCommercialStatus && (
        <TypeQuickFilters
          options={COMMERCIAL_STATUS_OPTIONS}
          selectedTypes={selectedCommercialStatus === 'all' ? [] : [selectedCommercialStatus]}
          onTypeChange={handleStatusChange}
          compact
          ariaLabel={t('sales.quickFilters.statusAriaLabel')}
        />
      )}

      {/* Row 2: Unit Type */}
      <TypeQuickFilters
        options={PROPERTY_TYPE_OPTIONS}
        selectedTypes={selectedPropertyType === 'all' ? [] : [selectedPropertyType]}
        onTypeChange={handleTypeChange}
        compact
        ariaLabel={t('sales.quickFilters.typeAriaLabel')}
      />
    </div>
  );
}
