'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Storage } from '@/types/storage/contracts';
import { defaultStorageFilters, type StorageFilterState } from '@/components/core/AdvancedFilters/configs/storageFiltersConfig';

export function useStoragesPageState(initialStorages: Storage[]) {
  // 🏢 ENTERPRISE: URL parameter handling for contextual navigation
  const searchParams = useSearchParams();
  const storageIdFromUrl = searchParams.get('storageId');

  const [selectedStorage, setSelectedStorage] = useState<Storage | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'byType' | 'byStatus'>('list');
  const [showDashboard, setShowDashboard] = useState(false);

  // Use centralized filter state
  const [filters, setFilters] = useState<StorageFilterState>(defaultStorageFilters);

  // 🏢 ENTERPRISE: Auto-selection from URL parameter (contextual navigation)
  useEffect(() => {
    if (!initialStorages.length) return;

    if (storageIdFromUrl) {
      // URL parameter has priority - find and select the storage
      const found = initialStorages.find(s => s.id === storageIdFromUrl);
      if (found) {
        console.log('📦 [useStoragesPageState] Auto-selecting storage from URL:', found.name);
        setSelectedStorage(found);
        return;
      }
    }

    // Default: select first storage if none selected
    if (!selectedStorage && initialStorages.length > 0) {
      setSelectedStorage(initialStorages[0]);
    }
  }, [initialStorages, storageIdFromUrl]);

  const filteredStorages = useMemo(() => {
    return initialStorages.filter(storage => {
      // Search filter - εκτεταμένη αναζήτηση
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesSearch = storage.name.toLowerCase().includes(searchLower) ||
                             storage.description?.toLowerCase().includes(searchLower) ||
                             storage.building?.toLowerCase().includes(searchLower) ||
                             storage.floor?.toLowerCase().includes(searchLower) ||
                             storage.type?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Status filter
      const statusFilter = filters.status && filters.status.length > 0 ? filters.status[0] : null;
      if (statusFilter && statusFilter !== 'all' && storage.status !== statusFilter) {
        return false;
      }

      // Type filter
      const typeFilter = filters.type && filters.type.length > 0 ? filters.type[0] : null;
      if (typeFilter && typeFilter !== 'all' && storage.type !== typeFilter) {
        return false;
      }

      // Building filter
      const buildingFilter = filters.building && filters.building.length > 0 ? filters.building[0] : null;
      if (buildingFilter && buildingFilter !== 'all' && storage.building !== buildingFilter) {
        return false;
      }

      // Floor filter
      const floorFilter = filters.floor && filters.floor.length > 0 ? filters.floor[0] : null;
      if (floorFilter && floorFilter !== 'all' && storage.floor !== floorFilter) {
        return false;
      }

      // Project filter
      const projectFilter = filters.project && filters.project.length > 0 ? filters.project[0] : null;
      if (projectFilter && projectFilter !== 'all' && storage.projectId !== projectFilter) {
        return false;
      }

      // Area range filter
      const areaRange = filters.ranges?.areaRange;
      if (areaRange?.min !== undefined && storage.area && storage.area < areaRange.min) {
        return false;
      }
      if (areaRange?.max !== undefined && storage.area && storage.area > areaRange.max) {
        return false;
      }

      // Price range filter
      const priceRange = filters.ranges?.priceRange;
      if (priceRange?.min !== undefined && storage.price && storage.price < priceRange.min) {
        return false;
      }
      if (priceRange?.max !== undefined && storage.price && storage.price > priceRange.max) {
        return false;
      }

      // Date range filter
      const dateRange = filters.ranges?.dateRange;
      if (dateRange?.start && storage.lastUpdated) {
        const storageDate = new Date(storage.lastUpdated);
        if (storageDate < dateRange.start) {
          return false;
        }
      }
      if (dateRange?.end && storage.lastUpdated) {
        const storageDate = new Date(storage.lastUpdated);
        if (storageDate > dateRange.end) {
          return false;
        }
      }

      return true;
    });
  }, [initialStorages, filters]);

  return {
    selectedStorage,
    setSelectedStorage,
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    filteredStorages,
    filters,
    setFilters,
  };
}