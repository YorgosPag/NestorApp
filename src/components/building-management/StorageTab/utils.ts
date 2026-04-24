
'use client';

import { Package, Warehouse } from 'lucide-react';
import type { StorageUnit, StorageType, StorageStatus } from '@/types/storage';

// 🏢 ENTERPRISE: Type for translate function (from useTranslation hook)
type TranslateFunction = (key: string) => string;


// 🏢 ENTERPRISE: i18n-enabled type label function
// 🌐 i18n: All fallbacks converted to i18n keys - 2026-01-18
export const getStorageTypeLabel = (type: StorageType, t?: TranslateFunction) => {
    const key = `pages.storage.typeLabels.${type}`;
    // Return translated value if t function provided, otherwise return the key
    return t ? t(key) : key;
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
        storageCount: units.length,
      };
}
