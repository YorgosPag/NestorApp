/**
 * Pure helpers for the Property PATCH handler.
 *
 * Extracts multi-level validation/aggregation, update-data building,
 * and cancellation detection so that route.ts stays lean.
 *
 * @module api/properties/[id]/property-patch-helpers
 * @see ADR-236 (Multi-level floors)
 * @see ADR-249 (Field locking)
 */

import { z } from 'zod';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { aggregateLevelData } from '@/services/multi-level.service';
import type { LevelData } from '@/types/property';

// ============================================================================
// SCHEMA + TYPES (re-exported so route.ts can import from here)
// ============================================================================

/** Zod schema for the PATCH request body. */
export const PropertyPatchSchema = z.object({
  name: z.string().max(500).optional(),
  type: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  floor: z.union([z.string().max(50), z.number()]).nullable().optional(),
  floorId: z.string().max(128).nullable().optional(),
  area: z.number().min(0).max(999_999).nullable().optional(),
  price: z.number().min(0).max(999_999_999).nullable().optional(),
  description: z.string().max(5000).optional(),
  buildingId: z.string().max(128).nullable().optional(),
  projectId: z.string().max(128).nullable().optional(),
  companyId: z.string().max(128).nullable().optional(),
  isMultiLevel: z.boolean().optional(),
  _v: z.number().int().optional(),
}).passthrough();

export interface PropertyMutationResult {
  id: string;
  _v?: number;
}

export interface PropertyLevelPayload {
  floorId: string;
  floorNumber: number;
  name: string;
  isPrimary: boolean;
}

/** Property PATCH body — core fields explicitly typed, extended fields passed through */
export interface PropertyPatchPayload extends Record<string, unknown> {
  name?: string;
  type?: string;
  status?: string;
  floor?: string | number;
  area?: number;
  price?: number;
  description?: string;
  buildingId?: string | null;
  projectId?: string | null;
  companyId?: string | null;
  companyName?: string;
  projectName?: string;
  // ADR-236: Multi-level fields
  isMultiLevel?: boolean;
  levels?: PropertyLevelPayload[];
  // ADR-236 Phase 2: Per-level data
  levelData?: Record<string, unknown>;
  // Auto-aggregated fields (set by server from levelData)
  areas?: Record<string, number>;
  layout?: Record<string, number>;
  orientations?: string[];
}

// ============================================================================
// applyMultiLevelDefaults
// ============================================================================

/**
 * ADR-236: Validate and mutate the body for multi-level floors.
 *
 * - Ensures exactly one primary floor when levels.length >= 2
 * - Auto-derives backward-compat fields (floor, floorId, isMultiLevel)
 * - Resets isMultiLevel to false when levels is cleared
 *
 * Mutates `body` in-place (same pattern as the original inline code).
 * @throws {ApiError} if primary-floor constraint is violated
 */
export function applyMultiLevelDefaults(body: PropertyPatchPayload): void {
  if (!Array.isArray(body.levels)) return;

  if (body.levels.length >= 2) {
    const primaryCount = body.levels.filter((l) => l.isPrimary).length;
    if (primaryCount !== 1) {
      throw new ApiError(400, 'Exactly one floor must be marked as primary');
    }
    const primary = body.levels.find((l) => l.isPrimary);
    if (primary) {
      body.floor = primary.floorNumber;
      body.floorId = primary.floorId;
      body.isMultiLevel = true;
    }
  } else if (body.levels.length === 0) {
    body.isMultiLevel = false;
  }
}

// ============================================================================
// applyLevelDataAggregation
// ============================================================================

/**
 * ADR-236 Phase 2: Validate per-level data keys against declared levels,
 * then auto-aggregate into top-level areas / layout / orientations.
 *
 * Mutates `body` in-place.
 * @throws {ApiError} if levelData contains floorIds not in declared levels
 */
export function applyLevelDataAggregation(
  body: PropertyPatchPayload,
  existingLevelsFromDoc: PropertyLevelPayload[] | undefined,
): void {
  if (!body.levelData || typeof body.levelData !== 'object') return;

  const ld = body.levelData as Record<string, LevelData>;
  const activeLevels = (body.levels ?? existingLevelsFromDoc) as PropertyLevelPayload[] | undefined;

  if (activeLevels && activeLevels.length >= 2) {
    const validFloorIds = new Set(activeLevels.map((l) => l.floorId));
    const invalidKeys = Object.keys(ld).filter((k) => !validFloorIds.has(k));
    if (invalidKeys.length > 0) {
      throw new ApiError(400, `levelData contains invalid floorIds: ${invalidKeys.join(', ')}`);
    }
  }

  const aggregated = aggregateLevelData(ld);
  body.areas = aggregated.areas;
  body.layout = aggregated.layout;
  body.orientations = aggregated.orientations;
}

// ============================================================================
// buildUpdateData
// ============================================================================

/** Fields that are NEVER writable via PATCH (security). */
const FORBIDDEN_FIELDS: ReadonlySet<string> = new Set([
  'id', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy',
]);

/**
 * Build the sanitized Firestore update payload from the validated body.
 *
 * - Strips forbidden fields and undefined values
 * - Trims string fields (name, floor, description)
 */
export function buildUpdateData(
  body: PropertyPatchPayload,
  existing: Record<string, unknown>,
): Record<string, unknown> {
  const updateData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    if (FORBIDDEN_FIELDS.has(key)) continue;
    if (value === undefined) continue;
    updateData[key] = value ?? null;
  }

  if (typeof updateData.name === 'string') {
    updateData.name = (updateData.name as string).trim() || existing.name;
  }
  if (typeof updateData.floor === 'string') {
    updateData.floor = (updateData.floor as string).trim() || null;
  }
  if (typeof updateData.description === 'string') {
    updateData.description = (updateData.description as string).trim() || null;
  }

  return updateData;
}

// ============================================================================
// detectCancellation
// ============================================================================

/**
 * Returns true when the PATCH transitions from sold/reserved to any other status.
 * Used to trigger contact-link deactivation (SPEC-257A).
 */
export function detectCancellation(
  existing: Record<string, unknown>,
  body: PropertyPatchPayload,
): boolean {
  const wasSoldOrReserved =
    existing.commercialStatus === 'reserved' || existing.commercialStatus === 'sold';
  const isNoLongerSoldOrReserved =
    !!body.commercialStatus
    && body.commercialStatus !== 'reserved'
    && body.commercialStatus !== 'sold';
  return wasSoldOrReserved && isNoLongerSoldOrReserved;
}
