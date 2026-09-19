/**
 * @fileoverview **Η κατάσταση φίλτρων ενός ΒΟΗΘΗΤΙΚΟΥ ΧΩΡΟΥ** (θέση στάθμευσης · αποθήκη) — ΜΙΑ δήλωση.
 * @related ADR-777 §8.60.14.14 · configs/parkingFiltersConfig.ts · configs/storageFiltersConfig.ts
 *
 * Ζούσε **δύο φορές, λέξη προς λέξη** (`ParkingFilterState` ⇄ `StorageFilterState`, μαζί με τις
 * προεπιλογές τους) — το έπιασε το `jscpd:diff` (CHECK 3.28) όταν η Φάση 4 έδωσε μονάδα στο εύρος
 * τιμής: η **ίδια** αλλαγή έπρεπε να γραφτεί σε δύο αρχεία, δηλαδή δύο σημεία ελεύθερα να αποκλίνουν.
 * Τα ονόματα ανά χώρο μένουν ως **ψευδώνυμα** (καμία αλλαγή για τους καλούντες).
 */

import { EMPTY_PRICE_RANGE, type RolePriceRange } from '@/lib/properties/price-range';

// 🏢 ENTERPRISE: index signature for GenericFilterState compatibility
export interface SpaceFilterState {
  [key: string]: unknown;
  searchTerm?: string;
  /** ADR-777 §8.60.20 — κουβάδες διάθεσης (`lib/spaces/space-availability`), όχι το παλιό `status`. */
  status?: string[];
  /** ADR-777 §8.60.20 — λειτουργική κατάσταση (`OPERATIONAL_STATUSES`). */
  operationalStatus?: string[];
  type?: string[];
  building?: string[];
  floor?: string[];
  project?: string[];
  ranges?: {
    areaRange?: { min?: number; max?: number };
    /** Εύρος τιμής **με μονάδα** (ADR-777 §8.60.14.14). */
    priceRange?: RolePriceRange;
    dateRange?: { start?: Date; end?: Date };
  };
}

/** Το κενό φίλτρο ενός βοηθητικού χώρου. */
export const DEFAULT_SPACE_FILTERS: SpaceFilterState = {
  searchTerm: '',
  status: [],
  operationalStatus: [],
  type: [],
  building: [],
  floor: [],
  project: [],
  ranges: {
    areaRange: { min: undefined, max: undefined },
    priceRange: EMPTY_PRICE_RANGE,
    dateRange: { start: undefined, end: undefined },
  },
};
