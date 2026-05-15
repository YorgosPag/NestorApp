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
import { getSuperAdminActiveCompanyId } from './super-admin-active-company';

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
  // Wait for Firebase Auth to finish initializing (handles SSR/hydration race)
  // — early-mounted consumers (NotificationDrawer, opportunities, navigation) hit
  // requireAuthContext before AuthContext finishes wiring; without this gate they
  // throw AUTHENTICATION_ERROR even though the user IS logged in.
  if (!auth.currentUser) {
    await waitForAuthReady();
  }

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

  const effectiveCompanyId = isSuperAdmin
    ? getSuperAdminActiveCompanyId()
    : null;

  return {
    uid: currentUser.uid,
    companyId,
    isSuperAdmin,
    effectiveCompanyId,
  };
}

/**
 * Resolves the effective companyId to filter client-side Firestore queries by.
 *
 * - Regular user → `ctx.companyId` (their tenant)
 * - Super admin WITH active switcher selection → `ctx.effectiveCompanyId`
 *   (impersonated tenant)
 * - Super admin WITHOUT switcher selection → `null` (cross-tenant view, the
 *   caller should skip the `where('companyId', ...)` constraint)
 *
 * ADR-356 SSOT: every custom service that does direct Firestore queries
 * outside `firestoreQueryService.subscribe` / `.getAll` MUST resolve its
 * tenant filter through this helper so the super-admin switcher (ADR-354)
 * is honored consistently. Without it, super-admin sessions read the
 * JWT-claim companyId and leak cross-tenant data.
 */
export function resolveEffectiveCompanyId(ctx: TenantContext): string | null {
  if (ctx.isSuperAdmin) return ctx.effectiveCompanyId;
  return ctx.companyId;
}
