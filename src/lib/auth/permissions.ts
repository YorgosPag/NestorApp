/**
 * @fileoverview Permission Checker - RFC v6 Implementation
 * @version 1.0.0
 * @author Nestor Construct Platform
 * @since 2026-01-14
 *
 * Server-side permission checker with request-scoped caching.
 * Handles global roles and project memberships (external users: `engagement-judge.ts`, ADR-862 Φ1).
 *
 * IMPORTANT: Uses request-scoped cache, NOT global Map (serverless-safe)
 *
 * @see docs/rfc/authorization-rbac.md
 */

import 'server-only';

import type { AuthContext, PermissionId } from './types';
import { isValidPermission } from './types';
import { isRoleBypass, getRolePermissions } from './roles';
import { getPermissionSetPermissions, requiresMfaEnrollment } from './permission-sets';
// ADR-801 §2.8 — το «πού ψάχνω» ζει χωριστά από το «τι αποφασίζω».
import {
  createPermissionCache,
  getProjectMembership,
  type PermissionCache,
} from './permissions/resource-lookups';
import { isProjectScopedAction } from './project-scoped-actions';

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
  | 'mfa_required';

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
  | 'permission_set';

// =============================================================================
// PERMISSION CHECKING
// =============================================================================

/**
 * Ο κλάδος έργου (ADR-926 Κ2 · Κ5): καλείται **μόνο** για πράξη του κλειστού καταλόγου, αφού ο κλάδος εταιρείας είπε όχι.
 *
 * Άρα η ιδιότητα μέλους μόνο προσθέτει. Οι αρνήσεις εδώ, MFA μαζί, δεν αφαιρούν ό,τι δίνει η εταιρεία.
 * Το `unknown`/`unreadable` του αναγνώστη φτάνει εδώ ως `null`, δηλαδή άρνηση.
 */
async function checkProjectRole(
  ctx: AuthContext,
  permission: PermissionId,
  projectId: string,
  requireMfa: boolean | undefined,
  cache: PermissionCache,
): Promise<PermissionCheckResult> {
  const membership = await getProjectMembership(ctx, projectId, cache);
  if (!membership) {
    return { granted: false, reason: 'no_project_membership' };
  }

  // Check MFA requirement for permission sets
  for (const setId of membership.permissionSetIds) {
    if (requiresMfaEnrollment(setId) && !ctx.mfaEnrolled) {
      return { granted: false, reason: 'mfa_required' };
    }
  }

  // Check explicit MFA requirement
  if (requireMfa && !ctx.mfaEnrolled) {
    return { granted: false, reason: 'mfa_required' };
  }

  // Check if permission is in effective permissions (precomputed)
  if (membership.effectivePermissions.includes(permission)) {
    return { granted: true, reason: null, source: 'project_role' };
  }

  // Fallback: compute from role + permission sets
  if (getRolePermissions(membership.roleId).includes(permission)) {
    return { granted: true, reason: null, source: 'project_role' };
  }

  for (const setId of membership.permissionSetIds) {
    if (getPermissionSetPermissions(setId).includes(permission)) {
      return { granted: true, reason: null, source: 'permission_set' };
    }
  }

  return { granted: false, reason: 'permission_not_in_role' };
}

/**
 * Check if user has a specific permission.
 *
 * Αθροιστικός κριτής (ADR-926 Κ1): επιτρέπεται αν το δίνει η εταιρεία **ή** το έργο.
 *
 * Check order:
 * 1. Global role bypass (super_admin)
 * 2. Ρητό claim εταιρείας
 * 3. Καθολικός ρόλος
 * 4. Ρόλος έργου, μόνο με `projectId` και μόνο για πράξη του `PROJECT_SCOPED_ACTIONS`
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

  // ⛔ Το παλιό «Check 3: Property grant (for external users)» ΑΦΑΙΡΕΘΗΚΕ (ADR-862 Φ1, 2026-10-02):
  //    0 καλούντες με `propertyId`, 0 γραφείς grant, και η ανάγνωση έψαχνε στον χώρο ΤΟΥ ΚΑΛΟΥΝΤΑ — δηλαδή
  //    δομικά ανίκανη να εξυπηρετήσει τον εξωτερικό για τον οποίο γράφτηκε. Ο εξωτερικός κρίνεται πλέον ΜΟΝΟ
  //    ανά πόρο, από τη συμμετοχή του (`lib/auth/engagement-judge.ts`) — ποτέ μέσα από δικαιώματα χώρου.

  // ===========================================================================
  // Ο ΚΛΑΔΟΣ ΕΤΑΙΡΕΙΑΣ — χωρίς πόρο εδώ οι δύο κριτές οφείλουν να συμφωνούν
  // ===========================================================================

  // Check 2: ρητά δοσμένο permission στο claim (ADR-801 §2.8).
  //
  // 🔑 **Η ΘΕΣΗ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ**: πριν τον ρόλο, μετά το bypass — **ίδια σειρά**
  //    με τα βήματα (5)→(6) του `decideCapability`. Η άγκυρα
  //    `__tests__/pdp-equivalence.test.ts` την κλειδώνει.
  //
  // 🔑 ADR-926 Κ1 — ο κλάδος εταιρείας κρίνεται ΠΡΙΝ από τον κλάδο έργου, γιατί η ιδιότητα μέλους μόνο προσθέτει.
  //    Μέχρι τις 2026-11-02 ο κλάδος έργου ερχόταν πρώτος και έκλεινε τον κριτή: ο `company_admin` που δεν ήταν μέλος
  //    απορριπτόταν, και μέλος `viewer` έχανε δικαιώματα εταιρείας.
  //
  // ⚠️ **Η ΑΙΤΙΟΛΟΓΗΣΗ ΑΛΛΑΞΕ, Ο ΚΑΝΟΝΑΣ ΟΧΙ** (ADR-813 Φάση Β): μέχρι
  //    2026-08-26 εδώ έγραφε ότι *«το claim **περιέχει** τα permissions του
  //    ρόλου»* — αληθές τότε (ο `claims-handler` τα αντέγραφε), **ψευδές
  //    σήμερα**: το claim κρατά πλέον **μόνο extras**, γιατί η αντιγραφή έσπαγε
  //    το όριο των **1.000 bytes** της Firebase για δύο ρόλους. Το Check 5 από
  //    κάτω **παράγει** ό,τι έδινε ο ρόλος, οπότε καμία ετυμηγορία δεν άλλαξε —
  //    άλλαξε μόνο το `source` (`company_scoped_claim` → `global_role`), που
  //    έχει **μηδέν καταναλωτές** (μετρημένο).
  //
  // ⚠️ Η παραχώρηση είναι **εμβέλειας εταιρείας**: το claim ζει δίπλα στο
  //    `companyId` και **δεν κουβαλά** δική του εμβέλεια — σε αντίθεση με το
  //    scope της ανάθεσης στο Azure RBAC ή το `Resource` του AWS IAM. Η πηγή το
  //    **ονομάζει**, ώστε να μη χρειάζεται να το θυμάται ο επόμενος.
  if (ctx.permissions?.includes(permission)) {
    return { granted: true, reason: null, source: 'company_scoped_claim' };
  }

  // Check 3: τα permissions του **καθολικού** ρόλου.
  const globalPermissions = getRolePermissions(ctx.globalRole);
  if (globalPermissions.includes(permission)) {
    // ⚠️ Ήταν `'project_role'` — **ψευδές**: εδώ δεν υπάρχει έργο, η παραχώρηση
    //    έρχεται από τον καθολικό ρόλο. Πέρασε απαρατήρητο επειδή **κανείς δεν
    //    διάβαζε** το `source` (μετρημένο: μηδέν καταναλωτές πριν το §2.8).
    return { granted: true, reason: null, source: 'global_role' };
  }

  // Check 4: ο ρόλος έργου, μόνο για πράξη του κλειστού καταλόγου (ADR-926 Κ2).
  if (options.projectId && isProjectScopedAction(permission)) {
    return checkProjectRole(ctx, permission, options.projectId, options.requireMfa, cache);
  }

  return { granted: false, reason: 'permission_not_in_role' };
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
