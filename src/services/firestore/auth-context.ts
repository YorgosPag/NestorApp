/**
 * @fileoverview Shared requireAuthContext — Centralized auth context extraction
 * @description Extracts TenantContext from Firebase Auth custom claims (ADR-214 Phase 1)
 * @version 1.0.0
 * @created 2026-03-12
 *
 * Pattern extracted from:
 * - src/services/crm/tasks/repositories/TasksRepository.ts (lines 19-45)
 * - src/services/calendar/AppointmentsRepository.ts
 */

import { auth } from '@/lib/firebase';
import type { TenantContext } from './firestore-query.types';

/**
 * Extracts tenant-aware authentication context from the current Firebase user.
 *
 * - Reads `companyId` and `globalRole` from custom claims (set via Firebase Admin SDK)
 * - Super admins (`globalRole === 'super_admin'`) may operate without a companyId
 * - Regular users without a companyId are rejected
 *
 * @throws {Error} If the user is not authenticated
 * @throws {Error} If a non-super-admin user has no companyId claim
 * @returns Promise resolving to TenantContext
 */
export async function requireAuthContext(): Promise<TenantContext> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error('AUTHENTICATION_ERROR: User must be logged in');
  }

  const tokenResult = await currentUser.getIdTokenResult();
  const companyId = (tokenResult.claims?.companyId as string | undefined) ?? null;
  const globalRole = tokenResult.claims?.globalRole as string | undefined;
  const isSuperAdmin = globalRole === 'super_admin';

  if (!companyId && !isSuperAdmin) {
    throw new Error('AUTHORIZATION_ERROR: User is not assigned to a company');
  }

  return {
    uid: currentUser.uid,
    companyId,
    isSuperAdmin,
  };
}
