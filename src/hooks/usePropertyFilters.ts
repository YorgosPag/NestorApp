
'use client';

import { useMemo } from 'react';
import type { Property, FilterState } from '@/types/property-viewer';
import type { PropertyStats } from '@/types/property';
import { DEFAULT_PROPERTY_STATS } from '@/types/property';
// 🏢 ADR-051: Use centralized filter utilities
import {
  matchesSearchTerm,
  matchesNumericRange,
  matchesArrayFilter,
  matchesFeatures
} from '@/components/core/AdvancedFilters';
import { EMPTY_PRICE_RANGE, matchesPriceRange } from '@/lib/properties/price-range';
import { totalPriceByRole } from '@/lib/properties/price-totals';
import { tallyBy } from '@/utils/collection-utils';
import { countDistinctBuildings, matchesPropertyLocation } from '@/lib/properties/property-location';
import { matchesAnySpaceAvailability, spaceAvailabilityBucket } from '@/lib/spaces/space-availability';
import { resolveSpaceStatuses } from '@/lib/spaces/space-status-split';
import { computeCoverageStats, type CoverageStats } from '@/lib/properties/coverage-stats';

/**
 * Τα στατιστικά της οθόνης ακινήτων — **πάνω στο φιλτραρισμένο σύνολο** (ADR-840 Σ3: το ταμπλό μετρά ό,τι βλέπεις,
 * πρότυπο Linear / Power BI cross-filter). Λειτουργικά + εμπορικά (`priceTotals` ανά ρόλο) + πληρότητα, σε ΕΝΑ σημείο.
 */
export interface PropertyScreenStats extends PropertyStats {
  /** Πόσα από τα ορατά είναι **στην αγορά** (κουβάς `listed`) — η κάρτα που ανοίγει/κλείνει το `?status=listed`. */
  onMarketProperties: number;
  coverage: CoverageStats;
}

export const EMPTY_PROPERTY_SCREEN_STATS: PropertyScreenStats = {
  ...DEFAULT_PROPERTY_STATS,
  onMarketProperties: 0,
  coverage: computeCoverageStats([]),
};


/**
 * 🏢 ENTERPRISE: Property type constants for filtering
 * Per local_4.log architecture - Units, Storage, Parking are PARALLEL categories
 */
const STORAGE_TYPES = ['storage', 'αποθήκη', 'αποθηκη'] as const;

/**
 * 🏢 ENTERPRISE: Check if a property is a storage unit
 * Storage units should NOT appear in the Units list (per local_4.log)
 */
function isStorageUnit(property: Property): boolean {
  // 🏢 ENTERPRISE: Check only property.type (propertyType doesn't exist on Property interface)
  const type = (property.type || '').toLowerCase();

  return STORAGE_TYPES.some(storageType => type.includes(storageType));
}

export function usePropertyFilters(
  properties: Property[],
  filters: FilterState,
  /** 🏢 ENTERPRISE (local_4.log): Exclude storage units from results */
  excludeStorageUnits: boolean = true
) {
  const { filteredProperties, stats } = useMemo(() => {
    if (!properties || !filters) {
      return { filteredProperties: [], stats: EMPTY_PROPERTY_SCREEN_STATS };
    }

    // 🏢 ENTERPRISE (local_4.log): Pre-filter to exclude storage units
    // Storage units are a PARALLEL category to Units, not part of Units
    const baseProperties = excludeStorageUnits
      ? properties.filter(p => !isStorageUnit(p))
      : properties;

    // 🏢 ADR-051: Use undefined for empty ranges (enterprise-grade type consistency)
    const {
      searchTerm = '',
      project = [],
      building = [],
      floor = [],
      propertyType = [],
      status = [],
      priceRange = EMPTY_PRICE_RANGE,
      areaRange = { min: undefined, max: undefined },
      features = [],
      coverage = {},
      operationalStatus = [],
    } = filters;

    // 🏢 ADR-051: Use centralized filter utilities
    const filtered = baseProperties.filter(property => {
      // Cast property to FilterableEntity for centralized utilities
      const entity = property as unknown as { id: string; [key: string]: unknown };

      // 🏢 CENTRALIZED: Search match using matchesSearchTerm
      const searchMatch = matchesSearchTerm(entity, searchTerm, ['name', 'description']);

      // ADR-840 §7.6 — έργο / κτίριο / όροφος με ΤΑΥΤΟΤΗΤΑ, από τον ΕΝΑ κριτή (κοινό με το
      // `usePublicPropertyViewer`). Ως τις 2026-10-15 σύγκρινε `property.project`/`.building` —
      // ονόματα που δεν υπάρχουν στο έγγραφο ⇒ κάθε επιλογή έργου άδειαζε τη λίστα.
      const locationMatch = matchesPropertyLocation(property, { project, building, floor });

      // 🏢 CENTRALIZED: Array filters using matchesArrayFilter
      const typeMatch = matchesArrayFilter(property.type, propertyType);
      // ADR-840 Σ3 — ΔΥΟ όψεις κατάστασης, ίδιοι κριτές με θέσεις/αποθήκες (ADR-777 §8.60.20). Ως τότε εδώ
      // `matchesArrayFilter(property.status, status)` με τιμές `ready`/`available` που το πεδίο δεν έχει ΠΟΤΕ.
      const statusMatch = matchesAnySpaceAvailability(property, status);
      const operationalMatch = operationalStatus.length === 0
        || operationalStatus.includes(resolveSpaceStatuses(property).operationalStatus ?? '');

      // 🏢 CENTRALIZED: Range filters
      // ADR-777 Α6 + §8.60.14.14 — the price range carries its UNIT: only an amount in
      // that role is judged (`matchesPriceRange`), never «up to 1.000» across a sale
      // price, a monthly rent and a nightly rate.
      const priceMatch = matchesPriceRange(property, priceRange);
      const areaMatch = matchesNumericRange(property.area, areaRange);

      // 🏢 CENTRALIZED: Features filter using matchesFeatures
      const featuresMatch = matchesFeatures(property.features, features);

      // ✅ DOMAIN-SPECIFIC: Coverage filters for "missing X" functionality
      // This is property-specific logic, not generic filtering
      const coverageMatch = !coverage || Object.keys(coverage).length === 0 || (() => {
        const { missingPhotos, missingFloorplans, missingDocuments } = coverage;

        // If no coverage filters are active, include all units
        if (!missingPhotos && !missingFloorplans && !missingDocuments) {
          return true;
        }

        // ⚠️ BACKWARD COMPATIBILITY: Handle units without propertyCoverage (treat as "missing")
        const propertyCoverage = property.propertyCoverage;

        // Check each filter condition
        const photosCondition = !missingPhotos || (propertyCoverage?.hasPhotos !== true);
        const floorplansCondition = !missingFloorplans || (propertyCoverage?.hasFloorplans !== true);
        const documentsCondition = !missingDocuments || (propertyCoverage?.hasDocuments !== true);

        return photosCondition && floorplansCondition && documentsCondition;
      })();

      return searchMatch && locationMatch && typeMatch && statusMatch && operationalMatch && priceMatch && areaMatch
        && featuresMatch && coverageMatch;
    });
    
    // ADR-777 Α5/Α6 + §8.60.14.13 — the totals read the price SSoT, PER ROLE: a sale
    // price, a monthly rent and a nightly rate are three units, never one sum.

    // 🎯 DOMAIN SEPARATION: Stats use operationalStatus where available
    const calculatedStats: PropertyScreenStats = {
      totalProperties: filtered.length,
      // availableProperties = operationalStatus 'ready' (Physical readiness)
      availableProperties: filtered.filter(p => p.operationalStatus === 'ready').length,
      priceTotals: totalPriceByRole(filtered, (p) => p.area),
      totalArea: filtered.reduce((sum, p) => sum + (p.area || 0), 0),
      // propertiesByStatus uses operationalStatus (not sales status)
      propertiesByStatus: tallyBy(filtered, p => p.operationalStatus || 'draft'),
      propertiesByType: tallyBy(filtered, p => p.type),
      // ADR-903: κλειδί = ο ΑΡΙΘΜΟΣ (δεδομένο)· η ετικέτα αποδίδεται στο `DetailsCard` (`useFloorLabel`).
      propertiesByFloor: tallyBy(filtered, p => String(p.floor ?? '—')),
      totalStorageUnits: 0, // storageUnits not available in this Property type
      availableStorageUnits: 0,
      uniqueBuildings: countDistinctBuildings(filtered),
      // Operational status metrics
      underConstructionProperties: filtered.filter(p => p.operationalStatus === 'under-construction').length,
      maintenanceProperties: filtered.filter(p => p.operationalStatus === 'maintenance').length,
      inspectionProperties: filtered.filter(p => p.operationalStatus === 'inspection').length,
      draftProperties: filtered.filter(p => p.operationalStatus === 'draft').length,
      onMarketProperties: filtered.filter((p) => spaceAvailabilityBucket(p) === 'listed').length,
      coverage: computeCoverageStats(filtered),
    };

    return { filteredProperties: filtered, stats: calculatedStats };
  }, [properties, filters, excludeStorageUnits]);

  return { filteredProperties, stats };
}

/**
 * 🏢 ENTERPRISE: Export isStorageUnit για χρήση σε άλλα components
 */
export { isStorageUnit, STORAGE_TYPES };
