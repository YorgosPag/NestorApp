/**
 * Canonical Parking Spot Types — Single Source of Truth
 *
 * ADR-191: All layers (API, hooks, UI, DXF Viewer) MUST use these types.
 * No local ParkingSpot interfaces allowed elsewhere.
 *
 * @module types/parking
 */

import { COLOR_BRIDGE } from '@/design-system/color-bridge';

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

/** Current status of parking spot */
export type ParkingSpotStatus =
  | 'available'
  | 'occupied'
  | 'reserved'
  | 'sold'
  | 'maintenance'
  | 'deleted';

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
  /** Current status */
  status?: ParkingSpotStatus;
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

  // ADR-199: Sales appurtenance fields
  /** Millesimal shares (χιλιοστά) — 0 = common, >0 = independently sellable */
  millesimalShares?: number | null;
  /** Commercial status for sales context */
  commercialStatus?: import('@/types/sales-shared').SpaceCommercialStatus;
  /** Commercial data overlay for sales */
  commercial?: import('@/types/sales-shared').SpaceCommercialData;
}

// =============================================================================
// STATS & FILTERS
// =============================================================================

export interface ParkingStats {
  totalSpots: number;
  soldSpots: number;
  availableSpots: number;
  occupiedSpots: number;
  reservedSpots: number;
  maintenanceSpots: number;
  totalValue: number;
  totalArea: number;
  averagePrice: number;
  spotsByType: Record<string, number>;
  spotsByFloor: Record<string, number>;
  spotsByStatus: Record<string, number>;
  spotsByLocationZone: Record<string, number>;
}

export interface ParkingFilters {
  searchTerm: string;
  type: string;
  status: string;
  floor: string;
  locationZone: string;
  minArea: number | null;
  maxArea: number | null;
  minPrice: number | null;
  maxPrice: number | null;
}

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

export const PARKING_STATUS_LABELS: Record<ParkingSpotStatus, string> = {
  available: 'parking.status.available',
  occupied: 'parking.status.occupied',
  reserved: 'parking.status.reserved',
  sold: 'parking.status.sold',
  maintenance: 'parking.status.maintenance',
  deleted: 'parking.status.deleted',
};

export const PARKING_LOCATION_ZONE_LABELS: Record<ParkingLocationZone, string> = {
  pilotis: 'parking.locationZone.pilotis',
  underground: 'parking.locationZone.underground',
  open_space: 'parking.locationZone.open_space',
  rooftop: 'parking.locationZone.rooftop',
  covered_outdoor: 'parking.locationZone.covered_outdoor',
};

// =============================================================================
// SEMANTIC COLORS (deprecated — use useSemanticColors().getParkingStatusClass())
// =============================================================================

/**
 * @deprecated Use colors.getParkingStatusClass(status) from useSemanticColors hook
 */
export const PARKING_STATUS_COLORS: Record<ParkingSpotStatus, string> = {
  sold: `${COLOR_BRIDGE.bg.success} ${COLOR_BRIDGE.text.success}`,
  available: `${COLOR_BRIDGE.bg.neutralSubtle} ${COLOR_BRIDGE.text.secondary}`,
  occupied: `${COLOR_BRIDGE.bg.info} ${COLOR_BRIDGE.text.info}`,
  reserved: `${COLOR_BRIDGE.bg.warning} ${COLOR_BRIDGE.text.warning}`,
  maintenance: `${COLOR_BRIDGE.bg.error} ${COLOR_BRIDGE.text.error}`,
  deleted: `${COLOR_BRIDGE.bg.neutralSubtle} ${COLOR_BRIDGE.text.secondary}`,
};

// =============================================================================
// CANONICAL ARRAYS (for iteration in UI)
// =============================================================================

export const PARKING_TYPES: ParkingSpotType[] = [
  'standard', 'handicapped', 'motorcycle', 'electric', 'visitor',
];

export const PARKING_STATUSES: ParkingSpotStatus[] = [
  'available', 'occupied', 'reserved', 'sold', 'maintenance',
];

export const PARKING_LOCATION_ZONES: ParkingLocationZone[] = [
  'pilotis', 'underground', 'open_space', 'rooftop', 'covered_outdoor',
];
