/**
 * Centralized Firestore → API Mappers — Single Source of Truth
 *
 * Κάθε mapper παράγει τον τύπο από το αντίστοιχο TypeScript interface.
 * Αν αλλάξει το interface → ο mapper ενημερώνεται ΕΔΩ ΜΟΝΟ.
 *
 * @see ADR-index for centralization decision
 */

import type { Storage, StorageType, StorageStatus } from '@/types/storage/contracts';
import type {
  ParkingSpot,
  ParkingSpotType,
  ParkingSpotStatus,
  ParkingLocationZone,
} from '@/types/parking';
import type { SpaceCommercialStatus, SpaceCommercialData } from '@/types/sales-shared';
import { normalizeToDate } from '@/lib/date-local';

// =============================================================================
// STORAGE MAPPER
// =============================================================================

const VALID_STORAGE_TYPES: readonly string[] = [
  'storage', 'large', 'small', 'basement', 'ground', 'special', 'garage', 'warehouse', 'parking',
];

const VALID_STORAGE_STATUSES: readonly string[] = [
  'available', 'occupied', 'maintenance', 'reserved', 'sold', 'unavailable',
];

export function isValidStorageType(value: string): value is StorageType {
  return VALID_STORAGE_TYPES.includes(value);
}

export function isValidStorageStatus(value: string): value is StorageStatus {
  return VALID_STORAGE_STATUSES.includes(value);
}

/**
 * Map a Firestore storage document to a type-safe Storage object.
 *
 * Covers every field declared in `Storage` (types/storage/contracts.ts).
 * Connection fields (buildingId, floorId, projectId, …) are always optional
 * because entities are created autonomously — links come later.
 */
export function mapStorageDoc(docId: string, data: Record<string, unknown>): Storage {
  const rawType = (data.type as string) || 'small';
  const rawStatus = (data.status as string) || 'available';

  return {
    id: docId,
    name: (data.name as string) || `Storage ${docId.substring(0, 6)}`,
    type: isValidStorageType(rawType) ? rawType : 'small',
    status: isValidStorageStatus(rawStatus) ? rawStatus : 'available',
    building: (data.building as string) || '',
    buildingId: data.buildingId as string | undefined,
    companyId: data.companyId as string | undefined,
    linkedCompanyId: (data.linkedCompanyId as string | null) ?? undefined,
    floor: (data.floor as string) || '',
    floorId: data.floorId as string | undefined,
    area: typeof data.area === 'number' ? data.area : 0,
    description: data.description as string | undefined,
    price: typeof data.price === 'number' ? data.price : undefined,
    projectId: data.projectId as string | undefined,
    owner: data.owner as string | undefined,
    notes: data.notes as string | undefined,
    lastUpdated: normalizeToDate(data.lastUpdated) || undefined,
    // ADR-199: Sales appurtenance fields
    millesimalShares: typeof data.millesimalShares === 'number' ? data.millesimalShares : (data.millesimalShares === null ? null : undefined),
    commercialStatus: data.commercialStatus as SpaceCommercialStatus | undefined,
    commercial: data.commercial as SpaceCommercialData | undefined,
  };
}

// =============================================================================
// PARKING MAPPER
// =============================================================================

const VALID_PARKING_TYPES: readonly string[] = [
  'standard', 'handicapped', 'motorcycle', 'electric', 'visitor',
];

const VALID_PARKING_STATUSES: readonly string[] = [
  'available', 'occupied', 'reserved', 'sold', 'maintenance',
];

const VALID_LOCATION_ZONES: readonly string[] = [
  'pilotis', 'underground', 'open_space', 'rooftop', 'covered_outdoor',
];

/**
 * Map a Firestore parking document to a type-safe ParkingSpot object.
 *
 * Covers every field declared in `ParkingSpot` (types/parking.ts).
 * Connection fields (buildingId, floorId, projectId, …) are always optional.
 */
export function mapParkingDoc(docId: string, data: Record<string, unknown>): ParkingSpot {
  const rawType = data.type as string | undefined;
  const rawStatus = data.status as string | undefined;
  const rawZone = data.locationZone as string | null | undefined;

  return {
    id: docId,
    number: (data.number as string) || (data.code as string) || `P-${docId.slice(0, 4)}`,
    buildingId: (data.buildingId as string) || null,
    projectId: data.projectId as string | undefined,
    locationZone: rawZone && VALID_LOCATION_ZONES.includes(rawZone)
      ? rawZone as ParkingLocationZone
      : (rawZone === null ? null : undefined),
    type: rawType && VALID_PARKING_TYPES.includes(rawType)
      ? rawType as ParkingSpotType
      : undefined,
    status: rawStatus && VALID_PARKING_STATUSES.includes(rawStatus)
      ? rawStatus as ParkingSpotStatus
      : undefined,
    floor: data.floor as string | undefined,
    floorId: data.floorId as string | undefined,
    location: data.location as string | undefined,
    area: typeof data.area === 'number' ? data.area : undefined,
    price: typeof data.price === 'number' ? data.price : undefined,
    notes: data.notes as string | undefined,
    companyId: data.companyId as string | undefined,
    linkedCompanyId: (data.linkedCompanyId as string | null) ?? undefined,
    createdBy: data.createdBy as string | undefined,
    createdAt: normalizeToDate(data.createdAt) || undefined,
    updatedAt: normalizeToDate(data.updatedAt) || undefined,
    // ADR-199: Sales appurtenance fields
    millesimalShares: typeof data.millesimalShares === 'number' ? data.millesimalShares : (data.millesimalShares === null ? null : undefined),
    commercialStatus: data.commercialStatus as SpaceCommercialStatus | undefined,
    commercial: data.commercial as SpaceCommercialData | undefined,
  };
}
