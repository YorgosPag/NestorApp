/**
 * =============================================================================
 * ENTERPRISE: Property (Unit) Creation Policy (Server-Side)
 * =============================================================================
 *
 * Layer 1 policy enforcement for unit creation (ADR-284 §3.1, §3.1.1).
 *
 * Blocks orphan units regardless of UI by validating:
 *   - Discriminated required fields based on PropertyType (Family A vs Family B)
 *   - Full upstream chain integrity: Project → Company (both families),
 *     Building → Project, Floor → Building (Family A only)
 *   - Multi-level units: every level[].floorId must belong to the same building
 *
 * Family A (in-building, 12 types): requires projectId + buildingId + floorId
 * Family B (standalone — detached_house, villa): requires projectId only,
 *   MUST NOT have buildingId/floorId (connects directly to Project)
 *
 * @module services/property/property-creation-policy
 * @enterprise ADR-284 §3.1 — Layer 1 Server-Side Unit Creation Policy
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { PropertyType } from '@/types/property';
import {
  STANDALONE_UNIT_TYPES as CANONICAL_STANDALONE_UNIT_TYPES,
  isStandaloneUnitType,
} from '@/constants/property-types';
import { EntityPolicyError, POLICY_ERROR_CODES } from '@/lib/policy';

// =============================================================================
// ERRORS
// =============================================================================

/**
 * Thin wrapper — fixes `entity: 'property'` so callers don't need to pass it.
 * All cross-entity codes live in `POLICY_ERROR_CODES` (SSoT).
 */
export class PropertyCreationPolicyError extends EntityPolicyError {
  constructor(
    code: (typeof POLICY_ERROR_CODES)[keyof typeof POLICY_ERROR_CODES],
    message: string,
    params?: Record<string, string>,
  ) {
    super(code, 'property', message, params);
    this.name = 'PropertyCreationPolicyError';
  }
}

// =============================================================================
// CONSTANTS (ADR-145: re-export από SSoT)
// =============================================================================

/**
 * Standalone unit types (Family B) — connect directly to Project, with no
 * building/floor placement. All other PropertyType values belong to Family A
 * (in-building) and require the full building/floor chain.
 *
 * ADR-145: Canonical definition ζει στο `@/constants/property-types`.
 */
export const STANDALONE_UNIT_TYPES: readonly PropertyType[] =
  CANONICAL_STANDALONE_UNIT_TYPES;

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
}

function isStandaloneType(type: unknown): boolean {
  return isStandaloneUnitType(type);
}

// =============================================================================
// POLICY ASSERTIONS — SYNC
// =============================================================================

/**
 * Synchronous discriminated validation of required fields based on
 * PropertyType (ADR-284 §3.1).
 *
 * @throws {PropertyCreationPolicyError} on any validation failure.
 */
export function assertPropertyCreatePolicy(
  propertyData: Record<string, unknown>,
): void {
  if (isBlank(propertyData.name)) {
    throw new PropertyCreationPolicyError(
      POLICY_ERROR_CODES.NAME_REQUIRED,
      'Property name is required before creation.',
    );
  }

  const type = propertyData.type;
  if (isBlank(type)) {
    throw new PropertyCreationPolicyError(
      POLICY_ERROR_CODES.TYPE_REQUIRED,
      'Property type is required before creation.',
    );
  }

  // ADR-284: projectId is ALWAYS required (both families)
  if (isBlank(propertyData.projectId)) {
    throw new PropertyCreationPolicyError(
      POLICY_ERROR_CODES.PROJECT_REQUIRED,
      'Project (projectId) is required — a unit cannot exist without a project.',
    );
  }

  const standalone = isStandaloneType(type);

  if (standalone) {
    // Family B: Standalone — MUST NOT carry buildingId/floorId
    if (!isBlank(propertyData.buildingId) || !isBlank(propertyData.floorId)) {
      throw new PropertyCreationPolicyError(
        POLICY_ERROR_CODES.STANDALONE_WITH_BUILDING,
        `Standalone units (${String(type)}) cannot have buildingId/floorId — they connect directly to Project.`,
        { type: String(type) },
      );
    }
    return;
  }

  // Family A: In-building — buildingId + floorId REQUIRED
  if (isBlank(propertyData.buildingId)) {
    throw new PropertyCreationPolicyError(
      POLICY_ERROR_CODES.BUILDING_REQUIRED,
      `Building (buildingId) is required for type "${String(type)}" — in-building units must belong to a building.`,
      { type: String(type) },
    );
  }
  if (isBlank(propertyData.floorId)) {
    throw new PropertyCreationPolicyError(
      POLICY_ERROR_CODES.FLOOR_REQUIRED,
      `Floor (floorId) is required for type "${String(type)}" — in-building units must be placed on a floor.`,
      { type: String(type) },
    );
  }
}

// =============================================================================
// POLICY ASSERTIONS — ASYNC (Firestore chain)
// =============================================================================

/**
 * Verifies full upstream chain integrity in Firestore (ADR-284 §3.1, §3.1.1).
 *
 * - Both families: Project must exist AND have linkedCompanyId; Company must exist.
 * - Family A: Building + Floor must exist and be consistently linked.
 * - Family A + isMultiLevel: every level[].floorId must belong to the same
 *   building as the primary floor (ADR-236 integration).
 *
 * MUST be called AFTER `assertPropertyCreatePolicy()` succeeds, so required
 * fields are guaranteed non-blank.
 *
 * @throws {PropertyCreationPolicyError} on any chain violation.
 */
export async function assertUpstreamChainExists(
  db: Firestore,
  propertyData: Record<string, unknown>,
): Promise<void> {
  const type = propertyData.type as PropertyType;
  const standalone = isStandaloneType(type);
  const projectId = propertyData.projectId as string;

  // ---- Both families: Project → Company ----
  const projectSnap = await db
    .collection(COLLECTIONS.PROJECTS)
    .doc(projectId)
    .get();
  if (!projectSnap.exists) {
    throw new PropertyCreationPolicyError(
      POLICY_ERROR_CODES.PROJECT_NOT_FOUND,
      'Project not found in Firestore.',
    );
  }
  const project = projectSnap.data() ?? {};
  const linkedCompanyId = project.linkedCompanyId;
  if (isBlank(linkedCompanyId)) {
    throw new PropertyCreationPolicyError(
      POLICY_ERROR_CODES.PROJECT_ORPHAN_NO_COMPANY,
      'Project has no linked Company — every project must belong to a Company (ADR-284 supersedes ADR-232).',
    );
  }

  const companySnap = await db
    .collection(COLLECTIONS.CONTACTS)
    .doc(linkedCompanyId as string)
    .get();
  if (!companySnap.exists) {
    throw new PropertyCreationPolicyError(
      POLICY_ERROR_CODES.COMPANY_NOT_FOUND,
      'Linked Company not found — data integrity violation.',
    );
  }
  const companyData = companySnap.data() ?? {};
  if (companyData.type !== 'company') {
    throw new PropertyCreationPolicyError(
      POLICY_ERROR_CODES.COMPANY_INVALID_TYPE,
      'Linked Company is not a valid company contact.',
    );
  }

  if (standalone) {
    // Family B: Done — no building/floor chain to verify
    return;
  }

  // ---- Family A: Building → Project, Floor → Building ----
  const buildingId = propertyData.buildingId as string;
  const floorId = propertyData.floorId as string;

  const buildingSnap = await db
    .collection(COLLECTIONS.BUILDINGS)
    .doc(buildingId)
    .get();
  if (!buildingSnap.exists) {
    throw new PropertyCreationPolicyError(
      POLICY_ERROR_CODES.BUILDING_NOT_FOUND,
      'Building not found.',
    );
  }
  const building = buildingSnap.data() ?? {};
  if (building.projectId !== projectId) {
    throw new PropertyCreationPolicyError(
      POLICY_ERROR_CODES.BUILDING_PROJECT_MISMATCH,
      'Building.projectId mismatch — building belongs to different project.',
    );
  }

  const floorSnap = await db
    .collection(COLLECTIONS.FLOORS)
    .doc(floorId)
    .get();
  if (!floorSnap.exists) {
    throw new PropertyCreationPolicyError(
      POLICY_ERROR_CODES.FLOOR_NOT_FOUND,
      'Floor not found.',
    );
  }
  const floor = floorSnap.data() ?? {};
  if (floor.buildingId !== buildingId) {
    throw new PropertyCreationPolicyError(
      POLICY_ERROR_CODES.FLOOR_BUILDING_MISMATCH,
      'Floor.buildingId mismatch — floor belongs to different building.',
    );
  }

  // ---- ADR-284 §3.1.1: Multi-level per-level validation (ADR-236 integration) ----
  if (
    propertyData.isMultiLevel === true &&
    Array.isArray(propertyData.levels)
  ) {
    for (const level of propertyData.levels as Array<Record<string, unknown>>) {
      const levelFloorId = level?.floorId;
      if (typeof levelFloorId !== 'string' || isBlank(levelFloorId)) {
        throw new PropertyCreationPolicyError(
          POLICY_ERROR_CODES.MULTILEVEL_FLOOR_REQUIRED,
          'Multi-level: every level must have floorId.',
        );
      }
      const levelFloorSnap = await db
        .collection(COLLECTIONS.FLOORS)
        .doc(levelFloorId)
        .get();
      if (!levelFloorSnap.exists) {
        throw new PropertyCreationPolicyError(
          POLICY_ERROR_CODES.FLOOR_NOT_FOUND,
          `Multi-level: floor ${levelFloorId} not found.`,
          { floorId: levelFloorId },
        );
      }
      const levelFloorData = levelFloorSnap.data() ?? {};
      if (levelFloorData.buildingId !== buildingId) {
        throw new PropertyCreationPolicyError(
          POLICY_ERROR_CODES.MULTILEVEL_FLOOR_MISMATCH,
          `Multi-level: floor ${levelFloorId} belongs to different building — all levels must share the same Building.`,
          { floorId: levelFloorId },
        );
      }
    }
  }
}

// =============================================================================
// DEFENSE-IN-DEPTH: server-side auto-fill
// =============================================================================

/**
 * Server-side auto-fill for `projectId` from Building.projectId.
 *
 * For in-building units (Family A), if the client did not send `projectId`,
 * derive it from `Building.projectId`. This is defense-in-depth — a
 * well-behaved client MUST still send projectId explicitly.
 *
 * Returns the resolved projectId, or null if the building has none.
 *
 * @throws {PropertyCreationPolicyError} if the building does not exist.
 */
export async function resolveProjectIdFromBuilding(
  db: Firestore,
  buildingId: string,
): Promise<string | null> {
  const snap = await db
    .collection(COLLECTIONS.BUILDINGS)
    .doc(buildingId)
    .get();
  if (!snap.exists) {
    throw new PropertyCreationPolicyError(
      POLICY_ERROR_CODES.BUILDING_NOT_FOUND,
      'Building not found.',
    );
  }
  const data = snap.data() ?? {};
  const projectId = data.projectId;
  return typeof projectId === 'string' && projectId.trim().length > 0
    ? projectId
    : null;
}
