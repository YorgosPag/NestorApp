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

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { getAdminFirestore } from '@/server/admin/admin-guards';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { ENTITY_STATUS } from '@/constants/entity-status-values';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import type {
  AssignmentPolicy,
  CreateAssignmentPolicyInput,
  UpdateAssignmentPolicyInput,
  AssignmentPolicyQuery,
} from '@/types/assignment-policy';

// ============================================================================
// LOGGER
// ============================================================================

const logger = createModuleLogger('ASSIGNMENT_POLICY');

// ============================================================================
// COLLECTION REFERENCE
// ============================================================================

function getPoliciesCollection() {
  return collection(db, COLLECTIONS.ASSIGNMENT_POLICIES);
}

// ============================================================================
// ADMIN COLLECTION (SERVER-SIDE)
// ============================================================================

function getPoliciesAdminCollection() {
  const adminDb = getAdminFirestore();
  return adminDb.collection(COLLECTIONS.ASSIGNMENT_POLICIES);
}

// ============================================================================
// CREATE
// ============================================================================

/**
 * Create new assignment policy
 * @enterprise Tenant-scoped, audit trail, version=1
 */
export async function createAssignmentPolicy(
  input: CreateAssignmentPolicyInput
): Promise<{ id: string; policy: AssignmentPolicy }> {
  const policiesRef = getPoliciesCollection();
  const newPolicyRef = doc(policiesRef);

  // Generate IDs για rules
  const rulesWithIds = input.rules.map((rule, index) => ({
    ...rule,
    id: `rule_${index + 1}`,
  }));

  const createdAt = new Date().toISOString();
  const newPolicy: AssignmentPolicy = {
    id: newPolicyRef.id,
    companyId: input.companyId,
    projectId: input.projectId || null,
    name: input.name,
    description: input.description,
    rules: rulesWithIds,
    triageSettings: input.triageSettings,
    taskDefaults: input.taskDefaults,
    status: ENTITY_STATUS.ACTIVE,
    createdBy: input.createdBy,
    createdAt,
    version: 1,
  };

  await setDoc(newPolicyRef, {
    ...newPolicy,
    createdAt: serverTimestamp()
  });

  return { id: newPolicyRef.id, policy: newPolicy };
}

// ============================================================================
// READ
// ============================================================================

/**
 * Get policy by ID
 * @enterprise Validates tenant isolation
 */
export async function getAssignmentPolicyById(
  policyId: string,
  companyId: string
): Promise<AssignmentPolicy | null> {
  const policiesRef = getPoliciesCollection();
  const policyDoc = doc(policiesRef, policyId);
  const snapshot = await getDoc(policyDoc);

  if (!snapshot.exists()) {
    return null;
  }

  const policy = snapshot.data() as AssignmentPolicy;

  // Tenant isolation check
  if (policy.companyId !== companyId) {
    logger.warn('Tenant isolation violation: Policy belongs to different company', {
      policyId,
      requestedCompanyId: companyId,
      actualCompanyId: policy.companyId,
    });
    return null;
  }

  return policy;
}

/**
 * Get policies by query
 * @enterprise Tenant-scoped queries
 */
export async function getAssignmentPolicies(
  queryParams: AssignmentPolicyQuery
): Promise<AssignmentPolicy[]> {
  const policiesRef = getPoliciesCollection();

  // Build query
  let q = query(
    policiesRef,
    where('companyId', '==', queryParams.companyId)
  );

  // Project filter
  if (queryParams.projectId !== undefined) {
    q = query(q, where('projectId', '==', queryParams.projectId));
  }

  // Status filter
  if (queryParams.status) {
    q = query(q, where('status', '==', queryParams.status));
  } else if (!queryParams.includeInactive) {
    // Default: only active policies
    q = query(q, where('status', '==', ENTITY_STATUS.ACTIVE));
  }

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => doc.data() as AssignmentPolicy);
}

/**
 * Get company-wide policy (projectId=null)
 * @enterprise Fallback policy για company
 */
export async function getCompanyWidePolicy(
  companyId: string
): Promise<AssignmentPolicy | null> {
  const policies = await getAssignmentPolicies({
    companyId,
    projectId: null,
    status: ENTITY_STATUS.ACTIVE,
  });

  // Return first active company-wide policy
  return policies.length > 0 ? policies[0] : null;
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
 * Get project-specific policy
 * @enterprise Project-scoped policy (higher priority than company-wide)
 */
export async function getProjectPolicy(
  companyId: string,
  projectId: string
): Promise<AssignmentPolicy | null> {
  const policies = await getAssignmentPolicies({
    companyId,
    projectId,
    status: ENTITY_STATUS.ACTIVE,
  });

  // Return first active project-specific policy
  return policies.length > 0 ? policies[0] : null;
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

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Update assignment policy
 * @enterprise Version tracking για change history
 */
export async function updateAssignmentPolicy(
  policyId: string,
  companyId: string,
  input: UpdateAssignmentPolicyInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const policiesRef = getPoliciesCollection();
    const policyDoc = doc(policiesRef, policyId);

    // Fetch current policy για validation
    const current = await getAssignmentPolicyById(policyId, companyId);
    if (!current) {
      logger.warn('Policy not found or access denied', { policyId, companyId });
      return { success: false, error: 'Policy not found or access denied' };
    }

    // Build update data
    const updatedAt = new Date().toISOString();
    const updateData: Partial<AssignmentPolicy> = {
      ...input,
      updatedBy: input.updatedBy,
      updatedAt,
      version: (current.version || 1) + 1,
    };

    await updateDoc(policyDoc, {
      ...updateData,
      updatedAt: serverTimestamp()
    });

    logger.info('Policy updated successfully', { policyId, companyId });
    return { success: true };
  } catch (error) {
    logger.error('Failed to update policy', {
      policyId,
      companyId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// DELETE (Soft Delete)
// ============================================================================

/**
 * Archive assignment policy (soft delete)
 * @enterprise Preserves audit trail
 */
export async function archiveAssignmentPolicy(
  policyId: string,
  companyId: string,
  archivedBy: string
): Promise<{ success: boolean; error?: string }> {
  return updateAssignmentPolicy(policyId, companyId, {
    status: 'archived',
    updatedBy: archivedBy,
  });
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if policy exists
 */
export async function policyExists(
  policyId: string,
  companyId: string
): Promise<boolean> {
  const policy = await getAssignmentPolicyById(policyId, companyId);
  return policy !== null;
}
