/**
 * 🔒 TENANT ISOLATION UTILITIES — «ανήκει ΑΥΤΟ το έγγραφο στον καλούντα;» στον server
 *
 * Enterprise-grade tenant isolation helpers for multi-tenant data access.
 * Ensures projects/resources belong to authenticated user's company.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΕΙΝΑΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΜΕΤΑ ΤΟ ADR-742
 * ─────────────────────────────────────────────────────────────────────────────
 * Είναι το **HTTP/Admin-SDK περίβλημα** γύρω από την ερώτηση, όχι η ερώτηση.
 * Η ερώτηση ζει **μία φορά** στο `lib/auth/tenant-ownership` (καθαρό module) και
 * την καλούν και τα τέσσερα μονοπάτια του κώδικα. Εδώ προστίθενται τα τρία που
 * χρειάζεται μόνο ο server: **fetch** από Admin SDK, **audit trail**, και
 * **τυποποιημένη άρνηση** (`TenantIsolationError` με status/code).
 *
 * Οι έξι `require*InTenant` είναι πλέον **δηλώσεις** πάνω στον έναν
 * {@link requireDocInTenant}. Ονόματα, υπογραφές, μηνύματα, κωδικοί και εγγραφές
 * audit είναι **αμετάβλητα** — 41 αρχεία καταναλωτές δεν αγγίχτηκαν.
 *
 * ⚠️ **ΜΗΝ ξαναγράψεις τη σύγκριση `companyId` εδώ.** Πριν το ADR-742 το ίδιο
 * 20γραμμο block ήταν αντιγραμμένο **έξι φορές** μέσα σε αυτό ακριβώς το αρχείο,
 * και η ίδια ερώτηση υπήρχε σε άλλα τρία συστήματα. Αν χρειάζεσαι νέα οντότητα,
 * πρόσθεσε **δήλωση**, όχι αντίγραφο.
 *
 * @module lib/auth/tenant-isolation
 * @version 2.0.0
 * @since 2026-01-17 - AUTHZ Phase 2
 * @enterprise ADR-255 (per-document ownership) · ADR-742 (η ερώτηση ενοποιήθηκε)
 * @see lib/auth/tenant-ownership — η ερώτηση + οι πολιτικές (καθαρό SSoT)
 * @see lib/auth/tenant-scope — ΔΙΑΦΟΡΕΤΙΚΗ ερώτηση: «ποιανού γραμμές να λιστάρω;» (ADR-702)
 */

// Direct imports to avoid circular dependency with @/lib/auth barrel
import type { AuthContext } from './types';
import type { AuditTargetType } from './audit-types';
import { logAuditEvent } from './audit';
import { isRoleBypass } from './roles';
import { isPayloadOwnedByCompany } from './tenant-ownership';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { TenantIsolationError } from './tenant-isolation-error';

// ADR-702: the class now lives in a leaf module so `tenant-scope.ts` can throw
// it without pulling the Admin SDK in. Re-exported here — this is still the
// canonical import path for every existing consumer.
export { TenantIsolationError } from './tenant-isolation-error';

// =============================================================================
// Ο ΠΥΡΗΝΑΣ — μία υλοποίηση, έξι δηλώσεις (ADR-742)
// =============================================================================

/** Το ελάχιστο που εγγυάται ένα έγγραφο με tenant. Το `?` είναι σκόπιμο: το Firestore δεν υπόσχεται πεδία. */
interface TenantScopedDoc {
  companyId?: string;
}

/** Ο λόγος άρνησης στο audit trail. Ένα string, ένας ορισμός — τα greps των logs βασίζονται σε αυτόν. */
const TENANT_MISMATCH_REASON = 'Tenant isolation violation - companyId mismatch';

/**
 * 🔒 Ο ένας φύλακας: φέρε το έγγραφο, κρίνε την ιδιοκτησία, κατάγραψε την άρνηση.
 *
 * **Η σειρά των βημάτων είναι το συμβόλαιο ασφαλείας**, όχι λεπτομέρεια:
 *
 * 1. **Ανύπαρκτο ⇒ 404** πριν καν κοιταχτεί ο tenant. Ένα «δεν υπάρχει» δεν
 *    πρέπει να κοστίζει διαφορετικό χρόνο ή να δίνει διαφορετικό μήνυμα από
 *    το «δεν είναι δικό σου», αλλιώς η ίδια η απάντηση γίνεται μαντείο.
 * 2. **Bypass ρόλος ⇒ πέρασε.** Ο υπεργραφέας έχει σκοπίμως cross-tenant
 *    ορατότητα (ADR-232) — η ιδιοκτησία δεν ελέγχεται καν.
 * 3. **Ξένο ⇒ audit + 403.** Η καταγραφή γίνεται **πριν** τη ρίψη: η απόπειρα
 *    είναι σήμα ασφαλείας και πρέπει να επιβιώνει ακόμη κι αν ο καλών
 *    καταπιεί το σφάλμα.
 *
 * ⚠️ Η ίδια η σύγκριση **δεν γράφεται εδώ** — τη δανείζεται από το
 * `tenant-ownership.isPayloadOwnedByCompany`, ώστε ο κανόνας «έγγραφο χωρίς
 * `companyId` δεν ανήκει σε κανέναν» να ισχύει με **ένα** ορισμό σε ολόκληρο
 * το repo.
 *
 * @param spec.notFoundMessage Χρησιμεύει **και** ως μήνυμα σφάλματος **και** ως
 *   `reason` στο audit — ήταν ήδη ταυτόσημα και στις έξι συναρτήσεις.
 */
async function requireDocInTenant<T extends TenantScopedDoc>(spec: {
  ctx: AuthContext;
  id: string;
  path: string;
  collection: string;
  targetType: AuditTargetType;
  notFoundMessage: string;
}): Promise<T> {
  const { ctx, id, path, collection, targetType, notFoundMessage } = spec;

  if (!getAdminFirestore()) {
    throw new Error('Firebase Admin not initialized');
  }

  const doc = await getAdminFirestore().collection(collection).doc(id).get();

  if (!doc.exists) {
    await logAuditEvent(ctx, 'access_denied', id, targetType, {
      metadata: { path, reason: notFoundMessage },
    });
    throw new TenantIsolationError(notFoundMessage, 404, 'NOT_FOUND');
  }

  const data = doc.data() as T | undefined;

  // 🏢 ENTERPRISE: Super Admin bypasses tenant isolation (cross-tenant access)
  // 🏢 ADR-232: Super admin entities may have companyId: null — allow access
  if (!isRoleBypass(ctx.globalRole) && !isPayloadOwnedByCompany(data, ctx.companyId)) {
    await logAuditEvent(ctx, 'access_denied', id, targetType, {
      metadata: { path, reason: TENANT_MISMATCH_REASON },
    });
    throw new TenantIsolationError('Access denied', 403, 'FORBIDDEN');
  }

  return data!;
}

/**
 * Minimal project data required for tenant verification.
 * Avoids widening to full Project type.
 */
export interface TenantProject {
  companyId: string;
  name?: string;
  status?: string;
}

/**
 * Minimal building data required for tenant verification.
 * Avoids widening to full Building type.
 */
export interface TenantBuilding {
  companyId: string;
  name?: string;
  projectId?: string | number;
}

/**
 * 🔒 Require project to belong to authenticated user's tenant.
 *
 * **Security:**
 * - Verifies project exists in Firestore
 * - Validates project.companyId === ctx.companyId
 * - Audits all access denials (404, 403)
 * - Throws on unauthorized access
 *
 * **Usage:**
 * ```typescript
 * const project = await requireProjectInTenant({
 *   ctx,
 *   projectId,
 *   path: '/api/projects/[id]/customers'
 * });
 * // project.companyId guaranteed to match ctx.companyId
 * ```
 *
 * @param params - Tenant isolation parameters
 * @param params.ctx - Authenticated user context
 * @param params.projectId - Project ID to verify
 * @param params.path - API path for audit trail
 * @returns Project data (guaranteed tenant-scoped)
 * @throws Error if project not found or tenant mismatch
 */
export async function requireProjectInTenant(params: {
  ctx: AuthContext;
  projectId: string;
  path: string;
}): Promise<TenantProject> {
  return requireDocInTenant<TenantProject>({
    ctx: params.ctx,
    id: params.projectId,
    path: params.path,
    collection: COLLECTIONS.PROJECTS,
    targetType: 'project',
    notFoundMessage: 'Project not found',
  });
}

/**
 * 🔒 Require building to belong to authenticated user's tenant.
 *
 * **Security:**
 * - Verifies building exists in Firestore
 * - Validates building.companyId === ctx.companyId
 * - Audits all access denials (404, 403)
 * - Throws on unauthorized access
 *
 * **Usage:**
 * ```typescript
 * const building = await requireBuildingInTenant({
 *   ctx,
 *   buildingId,
 *   path: '/api/buildings/[id]/customers'
 * });
 * // building.companyId guaranteed to match ctx.companyId
 * ```
 *
 * @param params - Tenant isolation parameters
 * @param params.ctx - Authenticated user context
 * @param params.buildingId - Building ID to verify
 * @param params.path - API path for audit trail
 * @returns Building data (guaranteed tenant-scoped)
 * @throws Error if building not found or tenant mismatch
 */
export async function requireBuildingInTenant(params: {
  ctx: AuthContext;
  buildingId: string;
  path: string;
}): Promise<TenantBuilding> {
  return requireDocInTenant<TenantBuilding>({
    ctx: params.ctx,
    id: params.buildingId,
    path: params.path,
    collection: COLLECTIONS.BUILDINGS,
    targetType: 'building',
    notFoundMessage: 'Building not found',
  });
}

// =============================================================================
// ADR-255 SPEC-255B — Additional Entity Tenant Isolation
// =============================================================================

/** Minimal property data required for tenant verification. */
export interface TenantProperty {
  companyId: string;
  name?: string;
  buildingId?: string;
}

/** @deprecated Use TenantProperty — kept for backward compatibility */
export type TenantUnit = TenantProperty;

/** Minimal storage data required for tenant verification. */
export interface TenantStorage {
  companyId: string;
  name?: string;
  buildingId?: string;
}

/** Minimal parking data required for tenant verification. */
export interface TenantParking {
  companyId: string;
  number?: string;
  projectId?: string;
}

/** Minimal opportunity data required for tenant verification. */
export interface TenantOpportunity {
  companyId: string;
  name?: string;
  stage?: string;
}

/**
 * 🔒 Require property to belong to authenticated user's tenant.
 */
export async function requirePropertyInTenantScope(params: {
  ctx: AuthContext;
  propertyId: string;
  path: string;
}): Promise<TenantProperty> {
  return requireDocInTenant<TenantProperty>({
    ctx: params.ctx,
    id: params.propertyId,
    path: params.path,
    collection: COLLECTIONS.PROPERTIES,
    targetType: 'property',
    notFoundMessage: 'Property not found',
  });
}

/**
 * @deprecated Use requirePropertyInTenantScope — kept for backward compatibility
 */
export async function requireUnitInTenant(params: {
  ctx: AuthContext;
  unitId: string;
  path: string;
}): Promise<TenantProperty> {
  return requirePropertyInTenantScope({
    ctx: params.ctx,
    propertyId: params.unitId,
    path: params.path,
  });
}

/**
 * 🔒 Require storage to belong to authenticated user's tenant.
 */
export async function requireStorageInTenant(params: {
  ctx: AuthContext;
  storageId: string;
  path: string;
}): Promise<TenantStorage> {
  return requireDocInTenant<TenantStorage>({
    ctx: params.ctx,
    id: params.storageId,
    path: params.path,
    collection: COLLECTIONS.STORAGE,
    targetType: 'storage',
    notFoundMessage: 'Storage not found',
  });
}

/**
 * 🔒 Require parking space to belong to authenticated user's tenant.
 */
export async function requireParkingInTenant(params: {
  ctx: AuthContext;
  parkingId: string;
  path: string;
}): Promise<TenantParking> {
  return requireDocInTenant<TenantParking>({
    ctx: params.ctx,
    id: params.parkingId,
    path: params.path,
    collection: COLLECTIONS.PARKING_SPACES,
    targetType: 'parking',
    notFoundMessage: 'Parking space not found',
  });
}

/**
 * 🔒 Require opportunity to belong to authenticated user's tenant.
 */
export async function requireOpportunityInTenant(params: {
  ctx: AuthContext;
  opportunityId: string;
  path: string;
}): Promise<TenantOpportunity> {
  return requireDocInTenant<TenantOpportunity>({
    ctx: params.ctx,
    id: params.opportunityId,
    path: params.path,
    collection: COLLECTIONS.OPPORTUNITIES,
    targetType: 'opportunity',
    notFoundMessage: 'Opportunity not found',
  });
}

// =============================================================================
// BATCH TENANT FILTER — for pre-fetched Firestore snapshots
// =============================================================================

/**
 * 🔒 Filter already-fetched Firestore snapshots by tenant ownership.
 *
 * Use this when you've already batch-fetched documents via `getAll()` and need
 * to apply tenant isolation without re-reading each document individually.
 *
 * Unlike `require*InTenant()`, this does NOT throw — it silently excludes
 * documents that don't belong to the tenant (treating them as "not found").
 * Super admins bypass the filter.
 *
 * Audit logging: denied IDs are batch-logged in a single audit event
 * (consistent with `require*InTenant()` which logs each denial individually).
 *
 * @param snapshots  Pre-fetched Firestore document snapshots
 * @param ctx        Authenticated user context
 * @param path       API path for audit trail (e.g. '/api/spaces/batch-resolve')
 * @returns Object with `allowed` (tenant-matching docs) and `denied` (IDs that failed tenant check)
 */
export async function filterSnapshotsByTenant(
  snapshots: ReadonlyArray<FirebaseFirestore.DocumentSnapshot>,
  ctx: AuthContext,
  path: string,
): Promise<{ allowed: FirebaseFirestore.DocumentSnapshot[]; denied: string[] }> {
  const isSuperAdmin = isRoleBypass(ctx.globalRole);
  const allowed: FirebaseFirestore.DocumentSnapshot[] = [];
  const denied: string[] = [];

  for (const snap of snapshots) {
    if (!snap.exists) continue;
    if (isSuperAdmin) {
      allowed.push(snap);
      continue;
    }
    // Ίδια ερώτηση με τις `require*InTenant` — ίδιος ορισμός (ADR-742).
    if (isPayloadOwnedByCompany(snap.data(), ctx.companyId)) {
      allowed.push(snap);
    } else {
      denied.push(snap.id);
    }
  }

  // Audit log denied access attempts (batch — one event for all denials)
  if (denied.length > 0) {
    await logAuditEvent(ctx, 'access_denied', denied.join(','), 'property', {
      metadata: {
        path,
        reason: `Tenant isolation violation - ${denied.length} document(s) denied: ${denied.join(', ')}`,
      },
    });
  }

  return { allowed, denied };
}
