"use client";

import React from "react";
import { Euro, Ruler } from "lucide-react";
import type { PublicPropertyFiltersProps } from "./types";
import { PRICE_MIN, PRICE_MAX, PRICE_STEP, AREA_MIN, AREA_MAX, AREA_STEP } from "./constants";
import { usePublicPropertyFilters } from "./hooks/usePublicPropertyFilters";
import { SearchField } from "./parts/SearchField";
import { TypeCheckboxes } from "./parts/TypeCheckboxes";
import { StatusCheckboxes } from "./parts/StatusCheckboxes";
import { RangeSlider } from "./parts/RangeSlider";

export function PublicPropertyFilters({ filters, onFiltersChange }: PublicPropertyFiltersProps) {
  const { onSearch, onTypeToggle, onStatusToggle, onPriceRange, onAreaRange } =
    usePublicPropertyFilters(filters, onFiltersChange);

  return (
    <div className="p-4 border-t bg-muted/30">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SearchField value={filters.searchTerm} onChange={onSearch} />

        <TypeCheckboxes selected={filters.propertyType} onToggle={onTypeToggle} />

        <StatusCheckboxes selected={filters.status} onToggle={onStatusToggle} />

        <div className="space-y-4">
          <RangeSlider
            label={<>Εύρος Τιμής</>}
            icon={Euro}
            min={PRICE_MIN}
            max={PRICE_MAX}
            step={PRICE_STEP}
            value={[filters.priceRange.min ?? PRICE_MIN, filters.priceRange.max ?? PRICE_MAX]}
            onChange={onPriceRange}
            formatLeft={(n) => `€${n}`}
            formatRight={(n) => `€${n}`}
          />

          <RangeSlider
            label={<>Εμβαδόν (m²)</>}
            icon={Ruler}
            min={AREA_MIN}
            max={AREA_MAX}
            step={AREA_STEP}
            value={[filters.areaRange.min ?? AREA_MIN, filters.areaRange.max ?? AREA_MAX]}
            onChange={onAreaRange}
            formatLeft={(n) => `${n}m²`}
            formatRight={(n) => `${n}m²`}
          />
        </div>
      </div>
    </div>
  );
}
