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
  priceRange: { min: number | null; max: number | null };
  areaRange: { min: number | null; max: number | null };
}

export interface SalesSpaceDashboardStats {
  availableCount: number;
  averagePrice: number;
  totalValue: number;
  averagePricePerSqm: number;
}

export type SalesViewMode = 'list' | 'grid';

// =============================================================================
// 🏢 ADR-199: APPURTENANCE HELPERS
// =============================================================================

/**
 * Determines if a parking/storage space can be sold independently.
 * A space with millesimal shares > 0 has its own legal identity and
 * can participate in a sale transaction.
 */
export function canSellIndependently(millesimalShares: number | null | undefined): boolean {
  return millesimalShares !== null && millesimalShares !== undefined && millesimalShares > 0;
}
