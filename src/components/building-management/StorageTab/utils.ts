
'use client';

import { Car, Package } from 'lucide-react';
import type { StorageUnit, StorageType, StorageStatus } from '@/types/storage';

export const getStatusColor = (status: StorageStatus) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'sold': return 'bg-blue-500';
      case 'reserved': return 'bg-yellow-500';
      case 'maintenance': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
};

export const getStatusLabel = (status: StorageStatus) => {
    switch (status) {
      case 'available': return 'Διαθέσιμο';
      case 'sold': return 'Πωλήθηκε';
      case 'reserved': return 'Κρατημένο';
      case 'maintenance': return 'Συντήρηση';
      default: return status;
    }
};

export const getTypeIcon = (type: StorageType) => {
    return type === 'storage' ? Package : Car;
};

export const getTypeLabel = (type: StorageType) => {
    return type === 'storage' ? 'Αποθήκη' : 'Θέση Στάθμευσης';
};

export const filterUnits = (
    units: StorageUnit[], 
    searchTerm: string, 
    filterType: StorageType | 'all', 
    filterStatus: StorageStatus | 'all',
    filterFloor: string
  ) => {
    return units.filter(unit => {
        const matchesSearch = unit.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             unit.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || unit.type === filterType;
        const matchesStatus = filterStatus === 'all' || unit.status === filterStatus;
        const matchesFloor = filterFloor === 'all' || unit.floor === filterFloor;
        
        return matchesSearch && matchesType && matchesStatus && matchesFloor;
      });
}

export const calculateStats = (units: StorageUnit[]) => {
    return {
        total: units.length,
        available: units.filter(u => u.status === 'available').length,
        sold: units.filter(u => u.status === 'sold').length,
        reserved: units.filter(u => u.status === 'reserved').length,
        totalValue: units.reduce((sum, u) => sum + u.price, 0),
        totalArea: units.reduce((sum, u) => sum + u.area, 0),
        storageCount: units.filter(u => u.type === 'storage').length,
        parkingCount: units.filter(u => u.type === 'parking').length
      };
}
