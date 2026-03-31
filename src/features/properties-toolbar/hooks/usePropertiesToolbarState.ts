'use client';
import { useState, useCallback } from 'react';

export function useUnitsToolbarState(
  totalUnits: number,
  selectedUnitIds: string[]
) {
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = useCallback((t: string) => setSearchTerm(t), []);
  const handleRefresh = useCallback(() => {
    /* noop: ίδια ροή (console.log παραμένει στο container) */
  }, []);
  const handleExport = useCallback(() => {
    /* noop */
  }, []);
  const toggleSort = useCallback(
    () => setSortDirection((p) => (p === 'asc' ? 'desc' : 'asc')),
    []
  );
  const toggleAdvancedMode = useCallback(() => setIsAdvancedMode((v) => !v), []);

  const allSelected =
    selectedUnitIds.length === totalUnits && totalUnits > 0;

  return {
    isAdvancedMode,
    sortDirection,
    activeFilters,
    searchTerm,
    setActiveFilters,
    handleSearch,
    handleRefresh,
    handleExport,
    toggleSort,
    toggleAdvancedMode,
    allSelected,
  };
}
