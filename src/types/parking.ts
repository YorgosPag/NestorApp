/**
 * Canonical Parking Spot Types — Single Source of Truth
 *
 * ADR-191: All layers (API, hooks, UI, DXF Viewer) MUST use these types.
 * No local ParkingSpot interfaces allowed elsewhere.
 *
 * @module types/parking
 */

import type { OperationalStatus } from '@/constants/operational-statuses';
import type { RecordLifecycleStatus } from '@/lib/firestore/trashed-status';

// =============================================================================
// ENUMS (string unions for Firestore compatibility)
// =============================================================================

/** Physical type of parking spot */
export type ParkingSpotType =
  | 'standard'
  | 'handicapped'
  | 'motorcycle'
  | 'electric'
  | 'visitor';

/**
 * ⛔ Εδώ ζούσε το ανάμεικτο `ParkingSpotStatus` (`available · occupied · reserved · sold ·
 * maintenance · deleted`) — τρία ερωτήματα σε ένα πεδίο. ADR-777 §8.60.20: εμπορικό →
 * `commercialStatus` · φυσικό → `operationalStatus` · κάδος → `status` (`RecordLifecycleStatus`).
 * Το παλιό πεδίο το διαβάζει **μόνο** το `lib/spaces/space-status-split`.
 */

/** Location zone — where the parking spot is physically situated */
export type ParkingLocationZone =
  | 'pilotis'
  | 'underground'
  | 'open_space'
  | 'rooftop'
  | 'covered_outdoor';

// =============================================================================
// CANONICAL INTERFACE — SSoT
// =============================================================================

/**
 * Canonical ParkingSpot interface.
 *
 * - `projectId` is REQUIRED (every spot belongs to a project)
 * - `buildingId` is OPTIONAL (null = open space / unlinked)
 * - `locationZone` describes physical placement
 */
export interface ParkingSpot {
  id: string;
  /** Display code, e.g. "P-001" */
  number: string;
  /** ADR-233: Entity coding system identifier, e.g. "A-PK-Y1.01" */
  code?: string;
  /** Project this spot belongs to (required) */
  projectId?: string;
  /** Building this spot is linked to (null = open space) */
  buildingId?: string | null;
  /** Physical location zone */
  locationZone?: ParkingLocationZone | null;
  /** Spot type */
  type?: ParkingSpotType;
  /** Κύκλος ζωής εγγραφής — ζωντανή ή στον κάδο (ADR-281). **Όχι** εμπορική ή φυσική κατάσταση. */
  status?: RecordLifecycleStatus;
  /** Φυσική χρηστικότητα — ίδιο λεξιλόγιο με τα ακίνητα (ADR-777 §8.60.20). Απούσα = αδήλωτη. */
  operationalStatus?: OperationalStatus;
  /** Floor/level identifier, e.g. "-1", "0", "pilotis" — canonical field (ADR-145) */
  floor?: string;
  /** Freeform location description */
  location?: string;
  /** Area in m^2 */
  area?: number;
  /** Price in euros */
  price?: number;
  /** Freeform description (separate from notes). ADR-194 */
  description?: string;
  /** Freeform notes */
  notes?: string;
  /** Tenant company ID (server-injected) */
  companyId?: string;
  /** 🏢 ADR-232: Business entity link (inherited from project via cascade) */
  linkedCompanyId?: string | null;
  /** User who created this record */
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  /**
   * 🏢 SPEC-256A: Optimistic-concurrency version counter. Acquired lazily on
   * first versioned update — absent on documents never updated since migration.
   */
  _v?: number;

  // ADR-199: Sales appurtenance fields
  /** Millesimal shares (χιλιοστά) — 0 = common, >0 = independently sellable */
  millesimalShares?: number | null;
  /** Commercial status for sales context */
  commercialStatus?: import('@/constants/commercial-statuses').CommercialStatus;
  /** Commercial data overlay for sales */
  commercial?: import('@/types/sales-shared').SpaceCommercialData;
}

// =============================================================================
// STATS & FILTERS
// =============================================================================

// ⛔ `ParkingStats` αφαιρέθηκε (ADR-777 §8.60.14.13): τύπος χωρίς κανέναν χρήστη, που
//    δήλωνε `totalValue`/`averagePrice` χωρίς ρόλο. Τα στατιστικά θέσεων ζουν στο
//    `hooks/useParkingStats` (`ParkingStats`, με `priceTotals` ανά ρόλο).

// =============================================================================
// I18N LABEL MAPS (values are i18n keys)
// =============================================================================

export const PARKING_TYPE_LABELS: Record<ParkingSpotType, string> = {
  standard: 'parking.types.standard',
  handicapped: 'parking.types.handicapped',
  motorcycle: 'parking.types.motorcycle',
  electric: 'parking.types.electric',
  visitor: 'parking.types.visitor',
};

export const PARKING_LOCATION_ZONE_LABELS: Record<ParkingLocationZone, string> = {
  pilotis: 'parking.locationZone.pilotis',
  underground: 'parking.locationZone.underground',
  open_space: 'parking.locationZone.open_space',
  rooftop: 'parking.locationZone.rooftop',
  covered_outdoor: 'parking.locationZone.covered_outdoor',
};

// =============================================================================
// CANONICAL ARRAYS (for iteration in UI)
// =============================================================================

export const PARKING_TYPES: ParkingSpotType[] = [
  'standard', 'handicapped', 'motorcycle', 'electric', 'visitor',
];

export const PARKING_LOCATION_ZONES: ParkingLocationZone[] = [
  'pilotis', 'underground', 'open_space', 'rooftop', 'covered_outdoor',
];
