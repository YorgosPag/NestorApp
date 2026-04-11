/**
 * =============================================================================
 * ENTERPRISE: Project Mutation Policy (Server-Side)
 * =============================================================================
 *
 * Layer 0 policy enforcement for project creation.
 * Ensures every Project has a valid linkedCompanyId (ADR-284).
 *
 * @module services/projects/project-mutation-policy
 * @enterprise ADR-284 §3.0 — Layer 0 Project Creation Policy
 * @supersedes ADR-232 (linkedCompanyId was optional; now REQUIRED)
 */

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { EntityPolicyError, POLICY_ERROR_CODES } from '@/lib/policy';

// =============================================================================
// ERRORS
// =============================================================================

/**
 * Thin wrapper — fixes `entity: 'project'` so callers don't need to pass it.
 * All cross-entity codes live in `POLICY_ERROR_CODES` (SSoT).
 */
export class ProjectMutationPolicyError extends EntityPolicyError {
  constructor(
    code: (typeof POLICY_ERROR_CODES)[keyof typeof POLICY_ERROR_CODES],
    message: string,
    params?: Record<string, string>,
  ) {
    super(code, 'project', message, params);
    this.name = 'ProjectMutationPolicyError';
  }
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
}

// =============================================================================
// POLICY ASSERTIONS
// =============================================================================

/**
 * Validates that the project creation payload contains the required fields.
 *
 * @throws {ProjectMutationPolicyError} if name or linkedCompanyId is blank.
 */
export function assertProjectCreatePolicy(projectData: Record<string, unknown>): void {
  if (isBlank(projectData.name)) {
    throw new ProjectMutationPolicyError(
      POLICY_ERROR_CODES.NAME_REQUIRED,
      'Project name is required.',
    );
  }

  // ADR-284: linkedCompanyId REQUIRED (supersedes ADR-232)
  if (isBlank(projectData.linkedCompanyId)) {
    throw new ProjectMutationPolicyError(
      POLICY_ERROR_CODES.COMPANY_REQUIRED,
      'Company (linkedCompanyId) is required — every project must belong to a company.',
    );
  }
}

/**
 * Verifies that the supplied linkedCompanyId points to an existing
 * company-type contact in Firestore.
 *
 * Companies are stored in the CONTACTS collection with type === 'company'.
 *
 * @returns Resolved company display name — callers reuse it to avoid a
 *          second fetch (e.g. audit trail human-readable snapshots per ADR-195).
 * @throws {ProjectMutationPolicyError} if the contact does not exist or
 *         is not of type 'company'.
 */
export async function assertLinkedCompanyExists(
  db: Firestore,
  linkedCompanyId: string
): Promise<{ companyName: string }> {
  if (isBlank(linkedCompanyId)) {
    throw new ProjectMutationPolicyError(
      POLICY_ERROR_CODES.COMPANY_REQUIRED,
      'Company (linkedCompanyId) is required — every project must belong to a company.',
    );
  }

  const contactSnap = await db
    .collection(COLLECTIONS.CONTACTS)
    .doc(linkedCompanyId)
    .get();

  if (!contactSnap.exists) {
    throw new ProjectMutationPolicyError(
      POLICY_ERROR_CODES.COMPANY_NOT_FOUND,
      'Linked Company not found — the referenced company does not exist.',
    );
  }

  const data = contactSnap.data();
  if (data?.type !== 'company') {
    throw new ProjectMutationPolicyError(
      POLICY_ERROR_CODES.COMPANY_INVALID_TYPE,
      'Linked Company is not a valid company contact.',
    );
  }

  const rawName = typeof data.companyName === 'string' ? data.companyName.trim() : '';
  return { companyName: rawName || linkedCompanyId };
}
