/**
 * =============================================================================
 * Contract types for the building-space route SSoT
 * =============================================================================
 *
 * Pure type surface shared by {@link createSpaceEntityRoutes} (the factory in
 * `space-entity-route.ts`) and its handler builders (`space-entity-handlers.ts`).
 * Extracted into its own `-types` module so the two implementation files can
 * each stay a single responsibility without a circular type import.
 *
 * @module lib/api/space-entity-route-types
 * @see ADR-696 Building-space route SSoT
 */

import type { z } from 'zod';
import type { AuthContext } from '@/lib/auth';
import type { Logger } from '@/lib/telemetry';
import type { SpaceDisplayField } from '@/lib/api/space-entity-fields';

/** Mutation envelope returned by PATCH/DELETE — `_v` is the post-write version. */
export interface SpaceMutationResult {
  id: string;
  _v?: number;
}

/**
 * Verbatim user-facing strings. NOT templated on purpose — the two migrated
 * routes were already inconsistent, and the wire contract must not change.
 */
export interface SpaceEntityMessages {
  /** 400 — e.g. 'Parking spot ID is required' / 'Storage ID is required' */
  idRequired: string;
  /** 200 PATCH — e.g. 'Parking spot updated' */
  updated: string;
  /** 200 DELETE — e.g. 'Storage unit moved to trash' */
  movedToTrash: string;
  /** 200 GET — e.g. 'Parking spot loaded' */
  loaded: string;
  /** 404 GET — e.g. 'Storage unit not found' */
  notFound: string;
  /** 500 PATCH fallback — e.g. 'Failed to update parking spot' */
  updateFailed: string;
  /** 500 DELETE fallback — e.g. 'Failed to delete storage unit' */
  deleteFailed: string;
  /** logger.error on PATCH — e.g. 'Error updating storage' */
  logUpdateError: string;
  /** logger.error on DELETE — e.g. 'Error deleting parking spot' */
  logDeleteError: string;
  /** logger.info on PATCH success — e.g. 'Parking spot updated' */
  logUpdated: string;
  /** logger.info on DELETE success — e.g. 'Storage unit moved to trash' */
  logMovedToTrash: string;
  /** logAuditEvent reason on PATCH */
  auditUpdateReason: string;
  /** logAuditEvent reason on DELETE */
  auditDeleteReason: string;
}

export interface SpaceEntityRouteConfig<TBody extends Record<string, unknown>> {
  /** Firestore collection id, e.g. `COLLECTIONS.PARKING_SPACES`. */
  collection: string;
  /** Soft-delete kind AND `linkEntity` key prefix — `'parking'` / `'storage'`. */
  entityKind: 'parking' | 'storage';
  /** Route path used in tenant-isolation + linkEntity audit trails. */
  apiPath: string;
  /** Per-route module logger (keeps log source attribution intact). */
  logger: Logger;
  /** `logAuditEvent` resource id, e.g. `'parking_spot'`. */
  auditResource: string;
  /** Key the audit payload uses for the entity id, e.g. `'parkingSpotId'`. */
  auditIdKey: string;
  /**
   * Human-facing display field. Feeds the ADR-247 allocationCode cascade fallback
   * (ADR-233: prefer `code`, fall back to this) and the delete audit payload.
   */
  displayField: SpaceDisplayField;
  /** Centralized tenant isolation guard (existence + companyId + audit). */
  requireInTenant: (params: { ctx: AuthContext; id: string; path: string }) => Promise<void>;
  /** Zod schema for the PATCH body. */
  updateSchema: z.ZodType<TBody>;
  /**
   * Entity-specific fields on top of {@link mapCommonSpaceFields}
   * (parking: `locationZone` / `projectId`; storage: `floorId`).
   */
  mapExtraFields: (body: TBody) => Record<string, unknown>;
  messages: SpaceEntityMessages;
}
