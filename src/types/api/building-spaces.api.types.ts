/**
 * Building Spaces API — Shared response types (SSoT)
 *
 * These are the shapes of the `data` field that apiClient.get<T>() returns
 * (the enterprise-api-client unwraps { success, data } automatically).
 *
 * Import these types in:
 *   - Route handlers: `satisfies { field: unknown[] }` for field-name enforcement
 *   - Consumer components: `apiClient.get<XxxApiData>(...)` for compile-time correctness
 *
 * @see src/app/api/properties/route.ts
 * @see src/app/api/parking/route.ts
 * @see src/app/api/storages/route.ts
 */

import type { Property } from '@/types/property';
import type { ParkingSpot } from '@/types/parking';
import type { Storage } from '@/types/storage/contracts';

// ── Units (Properties) ──────────────────────────────────────────────────────

/** Data payload from GET /api/properties */
export interface UnitsApiData {
  units: Property[];
  count: number;
}

// ── Parking ─────────────────────────────────────────────────────────────────

/** Data payload from GET /api/parking */
export interface ParkingApiData {
  parkingSpots: ParkingSpot[];
  count: number;
  cached: boolean;
  buildingId?: string;
  projectId?: string;
}

// ── Storage ─────────────────────────────────────────────────────────────────

/** Data payload from GET /api/storages */
export interface StoragesApiData {
  storages: Storage[];
  count: number;
  cached: boolean;
  projectId?: string;
}
