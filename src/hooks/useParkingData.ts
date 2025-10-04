'use client';

import { useState, useMemo } from 'react';
import type { ParkingSpot, ParkingFilters, ParkingStats } from '@/types/parking';
import { parkingSpots as mockParkingSpots } from '@/components/projects/parking/data';

export function useParkingData(initialSpots: ParkingSpot[] = mockParkingSpots) {
  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>(initialSpots);
  const [selectedSpots, setSelectedSpots] = useState<string[]>([]);
  const [filters, setFilters] = useState<ParkingFilters>({
    searchTerm: '',
    type: 'all',
    status: 'all',
    level: 'all',
    owner: '',
    minArea: null,
    maxArea: null,
    minPrice: null,
    maxPrice: null
  });

  const stats: ParkingStats = useMemo(() => {
    const totalSpots = parkingSpots.length;
    const soldSpots = parkingSpots.filter(spot => spot.status === 'sold').length;
    const ownerSpots = parkingSpots.filter(spot => spot.status === 'owner').length;
    const availableSpots = parkingSpots.filter(spot => spot.status === 'available').length;
    const reservedSpots = parkingSpots.filter(spot => spot.status === 'reserved').length;
    
    const totalValue = parkingSpots.reduce((sum, spot) => sum + spot.value, 0);
    const totalArea = parkingSpots.reduce((sum, spot) => sum + spot.area, 0);
    const averagePrice = totalSpots > 0 ? parkingSpots.reduce((sum, spot) => sum + spot.price, 0) / totalSpots : 0;

    const spotsByType = parkingSpots.reduce((acc, spot) => {
      acc[spot.type] = (acc[spot.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const spotsByLevel = parkingSpots.reduce((acc, spot) => {
      acc[spot.level] = (acc[spot.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const spotsByStatus = parkingSpots.reduce((acc, spot) => {
      acc[spot.status] = (acc[spot.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalSpots,
      soldSpots,
      ownerSpots,
      availableSpots,
      reservedSpots,
      totalValue,
      totalArea,
      averagePrice,
      spotsByType,
      spotsByLevel,
      spotsByStatus
    };
  }, [parkingSpots]);
  
  const filteredSpots = useMemo(() => {
    return parkingSpots.filter(spot => {
        const searchLower = filters.searchTerm.toLowerCase();

        const matchesSearch = filters.searchTerm.trim() === '' ||
            spot.code.toLowerCase().includes(searchLower) ||
            spot.owner.toLowerCase().includes(searchLower) ||
            spot.propertyCode.toLowerCase().includes(searchLower);

        const matchesType = filters.type === 'all' || spot.type === filters.type;
        const matchesStatus = filters.status === 'all' || spot.status === filters.status;
        const matchesLevel = filters.level === 'all' || spot.level === filters.level;
        const matchesOwner = filters.owner.trim() === '' || spot.owner.toLowerCase().includes(filters.owner.toLowerCase());

        return matchesSearch && matchesType && matchesStatus && matchesLevel && matchesOwner;
    });
  }, [parkingSpots, filters]);

  const handleFiltersChange = (newFilters: Partial<ParkingFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleExport = () => console.log('Εξαγωγή δεδομένων θέσεων στάθμευσης');
  const handleImport = () => console.log('Εισαγωγή δεδομένων θέσεων στάθμευσης');
  const handleAdd = () => console.log('Προσθήκη νέας θέσης στάθμευσης');
  const handleDelete = () => console.log('Διαγραφή επιλεγμένων θέσεων:', selectedSpots);
  const handleSave = () => console.log('Αποθήκευση αλλαγών');
  const handleRefresh = () => console.log('Ανανέωση δεδομένων');
  const handleEdit = (spot: ParkingSpot) => console.log('Επεξεργασία θέσης:', spot);
  const handleView = (spot: ParkingSpot) => console.log('Προβολή θέσης:', spot);
  const handleViewFloorPlan = (spot: ParkingSpot) => console.log('Προβολή κάτοψης για θέση:', spot);
  
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
      handleViewFloorPlan
  };
}
