'use client';
import * as React from 'react';
import { applyFilters, type FilterableProperty } from '../utils/filtering';

export function usePropertyGridFilters(allProperties: FilterableProperty[], filters: { propertyType: string[] }) {
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [priceRange, setPriceRange] = React.useState({ min: '', max: '' });
  const [areaRange, setAreaRange] = React.useState({ min: '', max: '' });

  // Σκόπιμα *δεν* αλλάζουμε το “availableProperties”: αφήνουμε το ίδιο flow
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
