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
  { value: 'all',        label: 'filters.unitTypes.all',        icon: LayoutGrid, tooltip: 'filters.unitTypes.allTooltip' },
  { value: 'studio',     label: 'filters.unitTypes.studio',     icon: BedSingle,  tooltip: 'filters.unitTypes.studioTooltip' },
  { value: 'apartment',  label: 'filters.unitTypes.apartment',  icon: Building2,  tooltip: 'filters.unitTypes.apartmentTooltip' },
  { value: 'maisonette', label: 'filters.unitTypes.maisonette', icon: Building2,  tooltip: 'filters.unitTypes.maisonetteTooltip' },
  { value: 'shop',       label: 'filters.unitTypes.shop',       icon: Store,      tooltip: 'filters.unitTypes.shopTooltip' },
  { value: 'office',     label: 'filters.unitTypes.office',     icon: Briefcase,  tooltip: 'filters.unitTypes.officeTooltip' },
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
}: SalesQuickFiltersProps) {
  const { t } = useTranslation('common');

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
      <TypeQuickFilters
        options={COMMERCIAL_STATUS_OPTIONS}
        selectedTypes={selectedCommercialStatus === 'all' ? [] : [selectedCommercialStatus]}
        onTypeChange={handleStatusChange}
        compact
        ariaLabel={t('sales.quickFilters.statusAriaLabel', { defaultValue: 'Φίλτρο εμπορικής κατάστασης' })}
      />

      {/* Row 2: Unit Type */}
      <TypeQuickFilters
        options={PROPERTY_TYPE_OPTIONS}
        selectedTypes={selectedPropertyType === 'all' ? [] : [selectedPropertyType]}
        onTypeChange={handleTypeChange}
        compact
        ariaLabel={t('sales.quickFilters.typeAriaLabel', { defaultValue: 'Φίλτρο τύπου μονάδας' })}
      />
    </div>
  );
}
