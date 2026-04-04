/**
 * =============================================================================
 * ENTERPRISE: Building Creation Policy (Server-Side)
 * =============================================================================
 *
 * Layer 0.5 policy enforcement for building creation (ADR-284 §3.0.5, §9.2).
 *
 * Blocks orphan buildings regardless of UI by validating:
 *   - Required fields: name, projectId (projectId is ALWAYS required)
 *   - Full upstream chain integrity: Project exists AND has linkedCompanyId
 *
 * Defense-in-depth: server enforcement is the only security boundary —
 * UI validation can be bypassed via browser devtools, direct API calls,
 * or import scripts.
 *
 * Mirrors the pattern from:
 *   - `src/services/property/property-creation-policy.ts` (Batch 2)
 *   - `src/services/projects/project-mutation-policy.ts` (Batch 1)
 *
 * @module services/building/building-creation-policy
 * @enterprise ADR-284 §3.0.5 — Layer 0.5 Server-Side Building Creation Policy
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';

// =============================================================================
// ERRORS
// =============================================================================

export class BuildingCreationPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BuildingCreationPolicyError';
  }
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
}

// =============================================================================
// POLICY ASSERTIONS — SYNC
// =============================================================================

/**
 * Synchronous validation of required fields for Building creation
 * (ADR-284 §3.0.5).
 *
 * @throws {BuildingCreationPolicyError} on any validation failure.
 */
export function assertBuildingCreatePolicy(
  data: Record<string, unknown>,
): void {
  if (isBlank(data.name)) {
    throw new BuildingCreationPolicyError(
      'Building name is required.',
    );
  }

  // ADR-284: projectId REQUIRED (every building must belong to a project)
  if (isBlank(data.projectId)) {
    throw new BuildingCreationPolicyError(
      'Project (projectId) is required — every building must belong to a project.',
    );
  }
}

// =============================================================================
// POLICY ASSERTIONS — ASYNC (Firestore chain)
// =============================================================================

/**
 * Verifies upstream chain integrity in Firestore (ADR-284 §3.0.5).
 *
 * - Project must exist.
 * - Project must have `linkedCompanyId` (5-level chain integrity per ADR-232).
 *
 * MUST be called AFTER `assertBuildingCreatePolicy()` succeeds, so required
 * fields are guaranteed non-blank.
 *
 * @throws {BuildingCreationPolicyError} on any chain violation.
 */
export async function assertBuildingUpstreamChain(
  db: Firestore,
  data: { projectId: string },
): Promise<void> {
  const projectSnap = await db
    .collection(COLLECTIONS.PROJECTS)
    .doc(data.projectId)
    .get();
  if (!projectSnap.exists) {
    throw new BuildingCreationPolicyError(
      'Referenced Project not found.',
    );
  }

  const linkedCompanyId = projectSnap.data()?.linkedCompanyId;
  if (isBlank(linkedCompanyId)) {
    throw new BuildingCreationPolicyError(
      'Referenced Project is orphan (no linkedCompanyId). Fix Project first.',
    );
  }
}
