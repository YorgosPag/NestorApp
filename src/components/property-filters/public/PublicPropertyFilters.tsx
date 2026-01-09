'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Euro, Ruler } from 'lucide-react';
import type { FilterState } from '@/types/property-viewer';
import { useIconSizes } from '@/hooks/useIconSizes';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';

import { propertyTypes, availabilityOptions, PRICE_MAX, AREA_MAX } from './constants';
import { usePublicPropertyFilterHandlers } from './hooks/usePublicPropertyFilterHandlers';
import { SearchField } from './components/SearchField';
import { CheckboxRow } from './components/CheckboxRow';
import { RangeSlider } from './components/RangeSlider';

// 🏢 ENTERPRISE: Centralized Unit Icon & Color
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;
const unitColor = NAVIGATION_ENTITIES.unit.color;

interface PublicPropertyFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

/**
 * ΣΗΜΑΝΤΙΚΟ: Το DOM structure, οι Tailwind κλάσεις, τα ελληνικά labels και οι ροές
 * παραμένουν ΑΠΑΡΑΛΛΑΚΤΑ. Μόνο σπάσιμο λογικής/σταθερών/μικρών components.
 */
export function PublicPropertyFilters({ filters, onFiltersChange }: PublicPropertyFiltersProps) {
  const iconSizes = useIconSizes();

  const {
    handleSearchChange,
    handleTypeChange,
    handleStatusChange,
    handlePriceRangeChange,
    handleAreaRangeChange,
  } = usePublicPropertyFilterHandlers(filters, onFiltersChange);

  return (
    <div className="p-4 border-t bg-muted/30">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Search */}
        <div className="space-y-2">
          <SearchField value={filters.searchTerm} onChange={handleSearchChange} />
        </div>

        {/* Property Types */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <UnitIcon className={`${iconSizes.sm} ${unitColor}`} />
            Τύπος Ακινήτου
          </Label>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {propertyTypes.map((type) => (
              <CheckboxRow
                key={type.value}
                id={`type-${type.value}`}
                checked={filters.propertyType.includes(type.value)}
                onCheckedChange={(checked) => handleTypeChange(type.value, checked)}
                label={type.label}
              />
            ))}
          </div>
        </div>

        {/* Availability */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Διαθεσιμότητα</Label>
          <div className="space-y-2">
            {availabilityOptions.map((option) => (
              <CheckboxRow
                key={option.value}
                id={`status-${option.value}`}
                checked={filters.status.includes(option.value)}
                onCheckedChange={(checked) => handleStatusChange(option.value, checked)}
                label={option.label}
              />
            ))}
          </div>
        </div>

        {/* Price & Area Ranges */}
        <div className="space-y-4">
          {/* Price Range */}
          <div className="space-y-2">
            <RangeSlider
              icon={<Euro className={iconSizes.sm} />}
              label="Εύρος Τιμής"
              values={[filters.priceRange.min || 0, filters.priceRange.max || PRICE_MAX]}
              onValueChange={handlePriceRangeChange}
              min={0}
              max={PRICE_MAX}
              step={5000}
              leftText={`€${filters.priceRange.min || 0}`}
              rightText={`€${filters.priceRange.max || PRICE_MAX}`}
            />
          </div>

          {/* Area Range */}
          <div className="space-y-2">
            <RangeSlider
              icon={<Ruler className={iconSizes.sm} />}
              label="Εμβαδόν (m²)"
              values={[filters.areaRange.min || 0, filters.areaRange.max || AREA_MAX]}
              onValueChange={handleAreaRangeChange}
              min={0}
              max={AREA_MAX}
              step={5}
              leftText={`${filters.areaRange.min || 0}m²`}
              rightText={`${filters.areaRange.max || AREA_MAX}m²`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
