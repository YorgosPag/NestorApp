'use client';

/**
 * @deprecated Legacy hook using mock data. Prefer useFirestoreParkingSpots for production.
 * ADR-191: Updated to canonical types.
 */

import { useState, useMemo } from 'react';
import type { ParkingSpot, ParkingFilters, ParkingStats } from '@/types/parking';
import { parkingSpots as mockParkingSpots } from '@/components/projects/parking/data';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useParkingData');

export function useParkingData(initialSpots: ParkingSpot[] = mockParkingSpots) {
  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>(initialSpots);
  const [selectedSpots, setSelectedSpots] = useState<string[]>([]);
  const [filters, setFilters] = useState<ParkingFilters>({
    searchTerm: '',
    type: 'all',
    status: 'all',
    floor: 'all',
    locationZone: 'all',
    minArea: null,
    maxArea: null,
    minPrice: null,
    maxPrice: null,
  });

  const stats: ParkingStats = useMemo(() => {
    const totalSpots = parkingSpots.length;
    const soldSpots = parkingSpots.filter(spot => spot.status === 'sold').length;
    const occupiedSpots = parkingSpots.filter(spot => spot.status === 'occupied').length;
    const availableSpots = parkingSpots.filter(spot => spot.status === 'available').length;
    const reservedSpots = parkingSpots.filter(spot => spot.status === 'reserved').length;
    const maintenanceSpots = parkingSpots.filter(spot => spot.status === 'maintenance').length;

    const totalValue = parkingSpots.reduce((sum, spot) => sum + (spot.price || 0), 0);
    const totalArea = parkingSpots.reduce((sum, spot) => sum + (spot.area || 0), 0);
    const averagePrice = totalSpots > 0 ? parkingSpots.reduce((sum, spot) => sum + (spot.price || 0), 0) / totalSpots : 0;

    const spotsByType = parkingSpots.reduce((acc, spot) => {
      const t = spot.type || 'standard';
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const spotsByFloor = parkingSpots.reduce((acc, spot) => {
      const f = spot.floor || 'unknown';
      acc[f] = (acc[f] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const spotsByStatus = parkingSpots.reduce((acc, spot) => {
      const s = spot.status || 'available';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const spotsByLocationZone = parkingSpots.reduce((acc, spot) => {
      const lz = spot.locationZone || 'unknown';
      acc[lz] = (acc[lz] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalSpots,
      soldSpots,
      occupiedSpots,
      availableSpots,
      reservedSpots,
      maintenanceSpots,
      totalValue,
      totalArea,
      averagePrice,
      spotsByType,
      spotsByFloor,
      spotsByStatus,
      spotsByLocationZone,
    };
  }, [parkingSpots]);

  const filteredSpots = useMemo(() => {
    return parkingSpots.filter(spot => {
      const searchLower = filters.searchTerm.toLowerCase();

      const matchesSearch = filters.searchTerm.trim() === '' ||
        (spot.number || '').toLowerCase().includes(searchLower) ||
        (spot.location || '').toLowerCase().includes(searchLower) ||
        (spot.notes || '').toLowerCase().includes(searchLower);

      const matchesType = filters.type === 'all' || spot.type === filters.type;
      const matchesStatus = filters.status === 'all' || spot.status === filters.status;
      const matchesFloor = filters.floor === 'all' || spot.floor === filters.floor;

      return matchesSearch && matchesType && matchesStatus && matchesFloor;
    });
  }, [parkingSpots, filters]);

  const handleFiltersChange = (newFilters: Partial<ParkingFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleExport = () => logger.info('Exporting parking spots data');
  const handleImport = () => logger.info('Importing parking spots data');
  const handleAdd = () => logger.info('Adding new parking spot');
  const handleDelete = () => logger.info('Deleting selected spots', { selectedSpots });
  const handleSave = () => logger.info('Saving changes');
  const handleRefresh = () => logger.info('Refreshing data');
  const handleEdit = (spot: ParkingSpot) => logger.info('Editing spot', { spotId: spot.id });
  const handleView = (spot: ParkingSpot) => logger.info('Viewing spot', { spotId: spot.id });
  const handleViewFloorPlan = (spot: ParkingSpot) => logger.info('Viewing floor plan for spot', { spotId: spot.id });

  return {
    parkingSpots: filteredSpots,
    selectedSpots,
    setSelectedSpots,
    filters,
    handleFiltersChange,
    stats,
    handleExport,
    handleImport,
    handleAdd,
    handleDelete,
    handleSave,
    handleRefresh,
    handleEdit,
    handleView,
    handleViewFloorPlan,
  };
}
