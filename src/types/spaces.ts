/**
 * Shared types for parking/storage space resolution.
 *
 * Used by:
 * - Server: `POST /api/spaces/batch-resolve` (route handler)
 * - Client: `useLinkedSpacesForSale` (hook)
 *
 * @module types/spaces
 * @see ADR-245 API Routes Centralization
 */

// =============================================================================
// Batch Resolve — Request / Response
// =============================================================================

/** Request body for POST /api/spaces/batch-resolve */
export interface BatchResolveRequest {
  spaceIds: string[];
}

/** A single space returned by batch-resolve */
export interface BatchResolvedSpace {
  id: string;
  spaceType: 'parking' | 'storage';
  area: number;
  commercial?: { askingPrice?: number };
  name?: string;
  buildingId?: string;
  floorId?: string;
  status?: string;
}

/** Response payload for POST /api/spaces/batch-resolve */
export interface BatchResolveResponse {
  spaces: BatchResolvedSpace[];
  notFound: string[];
}
