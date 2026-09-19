
'use client';

import { Package, Warehouse } from 'lucide-react';
import type { StorageUnit, StorageType } from '@/types/storage';
import { countSpaceStatuses, matchesSpaceAvailability } from '@/lib/spaces/space-availability';
import { totalPriceByRole } from '@/lib/properties/price-totals';

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
    filterStatus: string,
    filterFloor: string
  ) => {
    return units.filter(unit => {
        const matchesSearch = unit.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             unit.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || unit.type === filterType;
        // ADR-777 §8.60.20 — διάθεση από το `commercialStatus`, όχι από το παλιό ανάμεικτο `status`.
        const matchesStatus = matchesSpaceAvailability(unit, filterStatus);
        const matchesFloor = filterFloor === 'all' || unit.floor === filterFloor;
        
        return matchesSearch && matchesType && matchesStatus && matchesFloor;
      });
}

export const calculateStats = (units: StorageUnit[]) => {
    // ADR-777 §8.60.20 — οι μετρήσεις από το ΕΝΑ SSoT (κουβάδες του `commercialStatus`).
    const counts = countSpaceStatuses(units);
    return {
        total: units.length,
        available: counts.byAvailability.listed,
        sold: counts.byAvailability.sold,
        reserved: counts.byAvailability.reserved,
        // ADR-777 Α6 + §8.60.14.13 — ο ΕΝΑΣ επιλυτής, ανά ρόλο. Ήταν το τέταρτο
        // χειρόγραφο άθροισμα, και διάβαζε το @deprecated flat `price` χωρίς ρόλο.
        priceTotals: totalPriceByRole(units),
        totalArea: units.reduce((sum, u) => sum + u.area, 0),
        storageCount: units.length,
      };
}
