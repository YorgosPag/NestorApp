/**
 * @fileoverview Sales Shared Types — ADR-199
 * @description Shared commercial types for storage & parking sold as sale appurtenances
 * @pattern Enterprise SSoT — commercial overlay for auxiliary spaces
 */

// =============================================================================
// 🏢 COMMERCIAL STATUS (reuse from Unit)
// =============================================================================

export type SpaceCommercialStatus =
  | 'unavailable'
  | 'for-sale'
  | 'reserved'
  | 'sold';

// =============================================================================
// 🏢 COMMERCIAL DATA — overlay for Storage & Parking
// =============================================================================

import type { PropertyOwnerEntry } from '@/types/ownership-table';
import type { PriceTotalsByRole } from '@/lib/properties/price-totals';
import type { RolePriceRange } from '@/lib/properties/price-range';

export interface SpaceCommercialData {
  /** Asking price in EUR */
  askingPrice?: number | null;
  /** Final sale price in EUR */
  finalPrice?: number | null;
  /** Ιδιοκτήτες χώρου — SSoT (ADR-244 Phase 3) */
  owners?: PropertyOwnerEntry[] | null;
  /** Flat contactIds για Firestore queries (ADR-244 Phase 3) */
  ownerContactIds?: string[] | null;
  /** Date when listed for sale */
  listedDate?: { toDate?: () => Date } | null;
  /** Reservation deposit in EUR */
  reservationDeposit?: number | null;
}

// =============================================================================
// 🏢 SALES FILTER STATE (shared for storage & parking sales pages)
// =============================================================================

export interface SalesSpaceFilterState {
  searchTerm: string;
  status: string;
  type: string;
  building: string;
  floor: string;
  /** Εύρος τιμής **με μονάδα** (ADR-777 §8.60.14.14) — κρίνεται από το `matchesPriceRange`. */
  priceRange: RolePriceRange;
  areaRange: { min: number | null; max: number | null };
}

/**
 * Τα στατιστικά **κάθε** σελίδας πωλήσεων — ακίνητα, θέσεις στάθμευσης, αποθήκες, πωλημένα.
 *
 * 🔑 **ΕΝΑ σχήμα** (ADR-777 §8.60.14.13): ήταν δύο ταυτόσημα (`SalesDashboardStats` στο hook
 * των ακινήτων + αυτό), με τα **ίδια τέσσερα** πεδία — και τα δύο με το ίδιο ελάττωμα.
 * Αξία, μέση τιμή και €/m² ζουν πλέον **ανά ρόλο** στο `priceTotals`.
 */
export interface SalesDashboardStats {
  availableCount: number;
  priceTotals: PriceTotalsByRole;
}

export type SalesViewMode = 'list' | 'grid';

/**
 * Minimal shape a space must expose to be driven by `useSalesSpaceViewerState`.
 *
 * Structural, not nominal: both `ParkingSpot` and `Storage` satisfy it without
 * declaring so. Every field is optional because the two differ — `Storage` has a
 * required legacy `building` name, `ParkingSpot` only has `buildingId`.
 */
export interface SalesSpaceItem {
  id: string;
  status?: string;
  type?: string;
  floor?: string;
  area?: number | null;
  price?: number | null;
  /** Canonical building foreign key. */
  buildingId?: string | null;
  /** @deprecated Legacy building name — Storage only. Filtered as a fallback. */
  building?: string;
  commercial?: { askingPrice?: number | null } | null;
}

// =============================================================================
// 🏢 ADR-199: APPURTENANCE HELPERS
// =============================================================================

