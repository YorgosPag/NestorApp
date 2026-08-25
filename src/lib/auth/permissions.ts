/**
 * @fileoverview Permission Checker - RFC v6 Implementation
 * @version 1.0.0
 * @author Nestor Construct Platform
 * @since 2026-01-14
 *
 * Server-side permission checker with request-scoped caching.
 * Handles global roles, project memberships, and unit grants.
 *
 * IMPORTANT: Uses request-scoped cache, NOT global Map (serverless-safe)
 *
 * @see docs/rfc/authorization-rbac.md
 */

import 'server-only';

import type { AuthContext, PermissionId, GrantScope } from './types';
import { isValidPermission, isValidGrantScope } from './types';
import { isRoleBypass, getRolePermissions } from './roles';
import { getPermissionSetPermissions, requiresMfaEnrollment } from './permission-sets';
// ADR-801 §2.8 — το «πού ψάχνω» ζει χωριστά από το «τι αποφασίζω».
import {
  createPermissionCache,
  getProjectMembership,
  getPropertyGrant,
  type PermissionCache,
} from './permissions/resource-lookups';

/**
 * ⚠️ **Επανεξαγωγή, ώστε η δημόσια επιφάνεια να μείνει ακέραιη**: ~118
 * αρχεία-διαδρομές εισάγουν `PermissionCache` / `createPermissionCache` από το
 * barrel `@/lib/auth`, που τα παίρνει από **εδώ**. Η εξαγωγή του §2.8 ήταν
 * εσωτερική αναδιάταξη — δεν επιτρέπεται να γίνει αλλαγή API.
 */
export { createPermissionCache, type PermissionCache };

// =============================================================================
// TYPES
// =============================================================================

/**
 * Permission check options.
 */
export interface PermissionCheckOptions {
  /** Project ID for project-scoped permissions */
  projectId?: string;
  /** Property ID for property-scoped grants */
  propertyId?: string;
  /** @deprecated Use propertyId */
  unitId?: string;
  /** Require MFA verification for this check */
  requireMfa?: boolean;
}

/**
 * Permission check result with details.
 */
export interface PermissionCheckResult {
  granted: boolean;
  reason: PermissionDeniedReason | null;
  source?: PermissionSource;
}

/**
 * Why permission was denied.
 */
export type PermissionDeniedReason =
  | 'not_authenticated'
  | 'invalid_permission'
  | 'no_project_membership'
  | 'permission_not_in_role'
  | 'mfa_required'
  | 'grant_expired'
  | 'grant_not_found';

/**
 * Where permission was granted from.
 *
 * ⚠️ **Το `company_scoped_claim` ονομάζει ΕΜΒΕΛΕΙΑ, όχι μόνο πηγή** (ADR-801
 * §2.8): η ρητή παραχώρηση του claim ισχύει στην εμβέλεια της **εταιρείας** και
 * **δεν** υποκαθιστά τη συμμετοχή σε έργο. Το πρότυπο είναι το `context` των
 * λόγων του OpenID AuthZEN 1.0 — με τη διαφορά ότι εκεί είναι **προαιρετικό**.
 *
 * ⚠️ Το `global_role` ήταν μέχρι το §2.8 λανθασμένα `project_role`.
 */
export type PermissionSource =
  | 'global_role_bypass'
  | 'company_scoped_claim'
  | 'global_role'
  | 'project_role'
  | 'permission_set'
  | 'unit_grant';

// =============================================================================
// PERMISSION CHECKING
// =============================================================================

/**
 * Check if user has a specific permission.
 *
 * Check order:
 * 1. Global role bypass (super_admin)
 * 2. Project membership (if projectId provided)
 * 3. Unit grant (if unitId provided)
 *
 * @param ctx - Authenticated context
 * @param permission - Permission ID to check
 * @param options - Check options
 * @param cache - Permission cache (optional, created if not provided)
 * @returns Permission check result
 *
 * @example
 * ```typescript
 * const result = await checkPermission(ctx, 'projects:projects:view', { projectId: 'abc' });
 * if (!result.granted) {
 *   console.log('Denied:', result.reason);
 * }
 * ```
 */
export async function checkPermission(
  ctx: AuthContext,
  permission: PermissionId,
  options: PermissionCheckOptions = {},
  cache: PermissionCache = createPermissionCache()
): Promise<PermissionCheckResult> {
  // Validate permission ID
  if (!isValidPermission(permission)) {
    return { granted: false, reason: 'invalid_permission' };
  }

  // Check 1: Global role bypass (super_admin)
  if (isRoleBypass(ctx.globalRole)) {
    return { granted: true, reason: null, source: 'global_role_bypass' };
  }

  // Check 2: Project membership
  if (options.projectId) {
    const membership = await getProjectMembership(ctx, options.projectId, cache);

    if (membership) {
      // Check MFA requirement for permission sets
      for (const setId of membership.permissionSetIds) {
        if (requiresMfaEnrollment(setId) && !ctx.mfaEnrolled) {
          return { granted: false, reason: 'mfa_required' };
        }
      }

      // Check explicit MFA requirement
      if (options.requireMfa && !ctx.mfaEnrolled) {
        return { granted: false, reason: 'mfa_required' };
      }

      // Check if permission is in effective permissions (precomputed)
      if (membership.effectivePermissions.includes(permission)) {
        return { granted: true, reason: null, source: 'project_role' };
      }

      // Fallback: compute from role + permission sets
      const rolePermissions = getRolePermissions(membership.roleId);
      if (rolePermissions.includes(permission)) {
        return { granted: true, reason: null, source: 'project_role' };
      }

      for (const setId of membership.permissionSetIds) {
        const setPermissions = getPermissionSetPermissions(setId);
        if (setPermissions.includes(permission)) {
          return { granted: true, reason: null, source: 'permission_set' };
        }
      }

      return { granted: false, reason: 'permission_not_in_role' };
    }

    return { granted: false, reason: 'no_project_membership' };
  }

  // Check 3: Property grant (for external users)
  const effectivePropertyId = options.propertyId ?? options.unitId;
  if (effectivePropertyId) {
    const grant = await getPropertyGrant(ctx, effectivePropertyId, cache);

    if (!grant) {
      return { granted: false, reason: 'grant_not_found' };
    }

    // Check if grant is expired
    const now = new Date();
    const expiresAt = grant.expiresAt instanceof Date
      ? grant.expiresAt
      : new Date(grant.expiresAt);

    if (expiresAt < now) {
      return { granted: false, reason: 'grant_expired' };
    }

    // Check if grant was revoked
    if (grant.revokedAt) {
      return { granted: false, reason: 'grant_expired' };
    }

    // Map permission to grant scope
    const grantScope = permissionToGrantScope(permission);
    if (grantScope && grant.scopes.includes(grantScope)) {
      return { granted: true, reason: null, source: 'unit_grant' };
    }

    return { granted: false, reason: 'permission_not_in_role' };
  }

  // ===========================================================================
  // ΤΟ ΕΡΩΤΗΜΑ ΧΩΡΙΣ ΠΟΡΟ — εδώ και μόνο εδώ οι δύο κριτές οφείλουν να συμφωνούν
  // ===========================================================================

  // Check 4: ρητά δοσμένο permission στο claim (ADR-801 §2.8).
  //
  // 🔑 **Η ΘΕΣΗ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ**: πριν τον ρόλο, μετά το bypass — **ίδια σειρά**
  //    με τα βήματα (5)→(6) του `decideCapability`. Η άγκυρα
  //    `__tests__/pdp-equivalence.test.ts` την κλειδώνει.
  //
  // 🔴 **ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΨΗΛΟΤΕΡΑ, ΔΙΠΛΑ ΣΤΟ BYPASS**: το claim γράφεται ως
  //    `rolePermissions ∪ ρητά extras ∪ {admin_access}` (`claims-handler.ts:159`)
  //    — δηλαδή **περιέχει** τα permissions του ρόλου. Ο ρόλος συμβουλεύεται
  //    **μόνο** εδώ, στο σκέλος χωρίς πόρο. Αν το claim κρινόταν πριν από τα
  //    σκέλη με πόρο, το **ίδιο** permission id θα συμπεριφερόταν διαφορετικά
  //    ανάλογα με τη διαδρομή παράδοσης (ρόλος ή claim) — δύο απαντήσεις σε ένα
  //    ερώτημα, δηλαδή ADR-749 μέσα στη διόρθωσή του.
  //
  // ⚠️ Η παραχώρηση είναι **εμβέλειας εταιρείας**: το claim ζει δίπλα στο
  //    `companyId` και **δεν κουβαλά** δική του εμβέλεια — σε αντίθεση με το
  //    scope της ανάθεσης στο Azure RBAC ή το `Resource` του AWS IAM. Η πηγή το
  //    **ονομάζει**, ώστε να μη χρειάζεται να το θυμάται ο επόμενος.
  if (ctx.permissions?.includes(permission)) {
    return { granted: true, reason: null, source: 'company_scoped_claim' };
  }

  // Check 5: τα permissions του **καθολικού** ρόλου.
  const globalPermissions = getRolePermissions(ctx.globalRole);
  if (globalPermissions.includes(permission)) {
    // ⚠️ Ήταν `'project_role'` — **ψευδές**: εδώ δεν υπάρχει έργο, η παραχώρηση
    //    έρχεται από τον καθολικό ρόλο. Πέρασε απαρατήρητο επειδή **κανείς δεν
    //    διάβαζε** το `source` (μετρημένο: μηδέν καταναλωτές πριν το §2.8).
    return { granted: true, reason: null, source: 'global_role' };
  }

  return { granted: false, reason: 'permission_not_in_role' };
}

/**
 * Map permission ID to grant scope (for unit delegation).
 *
 * @param permission - Permission ID
 * @returns Grant scope or null
 */
function permissionToGrantScope(permission: PermissionId): GrantScope | null {
  // Map common permissions to grant scopes
  const mapping: Partial<Record<PermissionId, GrantScope>> = {
    'units:units:view': 'unit:read_basic',
    'legal:documents:view': 'legal:documents:view',
    'legal:contracts:view': 'legal:contracts:view',
    'dxf:files:view': 'unit:dxf:view',
    'comm:messages:view': 'unit:messages:view',
  };

  const scope = mapping[permission];
  return scope && isValidGrantScope(scope) ? scope : null;
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Check if user has a permission (simple boolean).
 *
 * @param ctx - Authenticated context
 * @param permission - Permission ID
 * @param options - Check options
 * @param cache - Permission cache
 * @returns True if granted
 *
 * @example
 * ```typescript
 * if (await hasPermission(ctx, 'projects:projects:update', { projectId })) {
 *   // Allow update
 * }
 * ```
 */
export async function hasPermission(
  ctx: AuthContext,
  permission: PermissionId,
  options: PermissionCheckOptions = {},
  cache: PermissionCache = createPermissionCache()
): Promise<boolean> {
  const result = await checkPermission(ctx, permission, options, cache);
  return result.granted;
}

/**
 * Require a permission, throw if denied.
 *
 * @param ctx - Authenticated context
 * @param permission - Permission ID
 * @param options - Check options
 * @param cache - Permission cache
 * @throws Error if permission denied
 *
 * @example
 * ```typescript
 * await requirePermission(ctx, 'projects:projects:delete', { projectId });
 * // If we get here, permission was granted
 * ```
 */
export async function requirePermission(
  ctx: AuthContext,
  permission: PermissionId,
  options: PermissionCheckOptions = {},
  cache: PermissionCache = createPermissionCache()
): Promise<void> {
  const result = await checkPermission(ctx, permission, options, cache);

  if (!result.granted) {
    const error = new Error(`Permission denied: ${permission} (${result.reason})`);
    error.name = 'PermissionDeniedError';
    throw error;
  }
}

/**
 * 🏛️ **Ο ΕΝΑΣ ΒΡΟΧΟΣ ΤΩΝ ΠΟΛΛΑΠΛΩΝ ΕΛΕΓΧΩΝ** (N.0.2 · CHECK 3.28).
 *
 * Το `hasAllPermissions` και το `hasAnyPermission` ήταν **ο ίδιος βρόχος γραμμένος δύο
 * φορές**, με μόνη διαφορά **ποια ετυμηγορία σταματά τη σάρωση**. Ο κλώνος ήταν
 * κληρονομημένος· τον ονόμασε το `jscpd --diff` όταν το αρχείο μπήκε σταδιοποιημένο.
 *
 * Επιστρέφει `true` μόλις βρεθεί η **πρώτη** άδεια που κρίνεται `granted === stopOn`.
 *
 * ⚠️ **ΣΕΙΡΙΑΚΟΣ ΕΠΙΤΗΔΕΣ, ΠΟΤΕ `Promise.all`**: η `cache` γεμίζει **σταδιακά** και ο
 * σύντομος τερματισμός είναι μέρος του συμβολαίου — παράλληλη εκτέλεση θα ρωτούσε τη
 * Firestore για άδειες που η απάντηση **έχει ήδη κριθεί άσχετη**.
 */
async function anyVerdictMatches(
  ctx: AuthContext,
  permissions: PermissionId[],
  options: PermissionCheckOptions,
  cache: PermissionCache,
  stopOn: boolean
): Promise<boolean> {
  for (const permission of permissions) {
    const result = await checkPermission(ctx, permission, options, cache);
    if (result.granted === stopOn) {
      return true;
    }
  }
  return false;
}

/**
 * Check multiple permissions (all must be granted).
 *
 * @param ctx - Authenticated context
 * @param permissions - Permission IDs
 * @param options - Check options
 * @param cache - Permission cache
 * @returns True if all granted
 */
export async function hasAllPermissions(
  ctx: AuthContext,
  permissions: PermissionId[],
  options: PermissionCheckOptions = {},
  cache: PermissionCache = createPermissionCache()
): Promise<boolean> {
  // «όλες δεκτές» == «καμία δεν βρέθηκε απορριμμένη»
  return !(await anyVerdictMatches(ctx, permissions, options, cache, false));
}

/**
 * Check multiple permissions (any must be granted).
 *
 * @param ctx - Authenticated context
 * @param permissions - Permission IDs
 * @param options - Check options
 * @param cache - Permission cache
 * @returns True if any granted
 */
export async function hasAnyPermission(
  ctx: AuthContext,
  permissions: PermissionId[],
  options: PermissionCheckOptions = {},
  cache: PermissionCache = createPermissionCache()
): Promise<boolean> {
  return anyVerdictMatches(ctx, permissions, options, cache, true);
}
