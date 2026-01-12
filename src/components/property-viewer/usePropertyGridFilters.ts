'use client';
import * as React from 'react';

// 🏢 ENTERPRISE: Property filtering utilities

/** Property data for filtering */
interface PropertyForFilter {
  id: string;
  name?: string;
  type?: string;
  price?: number;
  area?: number;
  [key: string]: unknown;
}

type Ranges = {
  priceRange: { min: string; max: string };
  areaRange: { min: string; max: string };
};

function applyFilters(
  properties: PropertyForFilter[],
  filters: { propertyType: string[] },
  searchTerm: string,
  ranges: Ranges
) {
  const { priceRange, areaRange } = ranges;
  return properties.filter((property) => {
    if (filters.propertyType.length > 0 && !filters.propertyType.includes(property.type)) return false;
    if (searchTerm && !property.name?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (priceRange.min && property.price < parseInt(priceRange.min)) return false;
    if (priceRange.max && property.price > parseInt(priceRange.max)) return false;
    if (areaRange.min && property.area < parseInt(areaRange.min)) return false;
    if (areaRange.max && property.area > parseInt(areaRange.max)) return false;
    return true;
  });
}

export function usePropertyGridFilters(allProperties: PropertyForFilter[], filters: { propertyType: string[] }) {
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [priceRange, setPriceRange] = React.useState({ min: '', max: '' });
  const [areaRange, setAreaRange] = React.useState({ min: '', max: '' });

  // Σκόπιμα *δεν* αλλάζουμε το "availableProperties": αφήνουμε το ίδιο flow
  const availableProperties = allProperties;

  const filteredProperties = React.useMemo(
    () => applyFilters(availableProperties, filters, searchTerm, { priceRange, areaRange }),
    [availableProperties, filters, searchTerm, priceRange, areaRange]
  );

  return {
    viewMode, setViewMode,
    showFilters, setShowFilters,
    searchTerm, setSearchTerm,
    priceRange, setPriceRange,
    areaRange, setAreaRange,
    availableProperties,
    filteredProperties,
  };
}