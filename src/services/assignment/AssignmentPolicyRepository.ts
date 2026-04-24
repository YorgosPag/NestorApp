/**
 * =============================================================================
 * ASSIGNMENT POLICY REPOSITORY
 * =============================================================================
 *
 * 🏢 ENTERPRISE: Data access layer για Assignment Policies.
 * Handles Firestore CRUD με tenant isolation και audit trail.
 *
 * @module services/assignment/AssignmentPolicyRepository
 * @enterprise Firestore boundary, tenant-scoped
 *
 * ARCHITECTURE:
 * - All operations tenant-scoped (companyId required)
 * - Version field για tracking changes
 * - Audit trail (createdBy, updatedBy, timestamps)
 */

'use server';
import 'server-only';

import { getAdminFirestore } from '@/server/admin/admin-guards';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { ENTITY_STATUS } from '@/constants/entity-status-values';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import type { AssignmentPolicy } from '@/types/assignment-policy';

// ============================================================================
// LOGGER
// ============================================================================

const logger = createModuleLogger('ASSIGNMENT_POLICY');

// ============================================================================
// ADMIN COLLECTION (SERVER-SIDE)
// ============================================================================

function getPoliciesAdminCollection() {
  const adminDb = getAdminFirestore();
  return adminDb.collection(COLLECTIONS.ASSIGNMENT_POLICIES);
}


/**
 * Get company-wide policy (Admin SDK)
 * @enterprise Server-side only, bypasses client rules
 */
export async function getCompanyWidePolicyAdmin(
  companyId: string
): Promise<AssignmentPolicy | null> {
  const policiesRef = getPoliciesAdminCollection();
  const snapshot = await policiesRef
    .where(FIELDS.COMPANY_ID, '==', companyId)
    .where(FIELDS.PROJECT_ID, '==', null)
    .where(FIELDS.STATUS, '==', ENTITY_STATUS.ACTIVE)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].data() as AssignmentPolicy;
}


/**
 * Get project-specific policy (Admin SDK)
 * @enterprise Server-side only, bypasses client rules
 */
export async function getProjectPolicyAdmin(
  companyId: string,
  projectId: string
): Promise<AssignmentPolicy | null> {
  const policiesRef = getPoliciesAdminCollection();
  const snapshot = await policiesRef
    .where(FIELDS.COMPANY_ID, '==', companyId)
    .where(FIELDS.PROJECT_ID, '==', projectId)
    .where(FIELDS.STATUS, '==', ENTITY_STATUS.ACTIVE)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const policy = snapshot.docs[0].data() as AssignmentPolicy;
  if (policy.companyId !== companyId) {
    logger.warn('Tenant isolation violation: Policy belongs to different company', {
      policyId: policy.id,
      requestedCompanyId: companyId,
      actualCompanyId: policy.companyId,
    });
    return null;
  }

  return policy;
}


