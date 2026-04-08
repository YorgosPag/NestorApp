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
import { onAuthStateChanged } from 'firebase/auth';
import type { TenantContext } from './firestore-query.types';

/**
 * Waits for Firebase Auth to finish initializing.
 *
 * During SSR hydration, `auth.currentUser` is null even for logged-in users
 * because Firebase hasn't restored the session yet. This helper resolves once
 * the first `onAuthStateChanged` callback fires — at that point the auth state
 * is authoritative (user or null).
 *
 * @returns `true` if a user is authenticated, `false` otherwise
 */
export function waitForAuthReady(): Promise<boolean> {
  // Already initialized — resolve immediately
  if (auth.currentUser) return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(!!user);
    });
  });
}

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
