import 'server-only';

/**
 * =============================================================================
 * ΠΟΥ ΨΑΧΝΩ — οι αναγνώσεις πόρων του PDP (ADR-801 §2.8, Φάση 3γ)
 * =============================================================================
 *
 * **Εξήχθη, δεν γράφτηκε** (Boy Scout, N.0.2): ο κώδικας είναι **αυτούσιος**
 * από το `lib/auth/permissions.ts`, μαζί με τα σχόλιά του.
 *
 * 🔑 **ΓΙΑΤΙ ΧΩΡΙΣΤΑ — ΔΥΟ ΕΥΘΥΝΕΣ**: το «**πού ψάχνω**» (συμμετοχή στο έργο ·
 * παραχώρηση σε ακίνητο · η σύνδεση με τη βάση) είναι άλλη ευθύνη από το «**τι
 * αποφασίζω**» (`checkPermission`). Ο άμεσος λόγος ήταν το N.7.1: το
 * `permissions.ts` είχε φτάσει **494/500** γραμμές και η Φάση 3γ πρόσθετε το
 * βήμα του ρητού claim. **Εξαγωγή, ποτέ κόψιμο σχολίων.**
 *
 * ⚠️ **Η δημόσια επιφάνεια ΔΕΝ άλλαξε**: τα `PermissionCache` /
 * `createPermissionCache` **επανεξάγονται** από το `permissions.ts`, οπότε τα
 * ~118 αρχεία-διαδρομές που τα εισάγουν από το barrel `@/lib/auth` δεν
 * αγγίχτηκαν. Ο έλεγχος είναι μηχανικός: αν είχαν αλλάξει, δεν θα μεταγλωττιζόταν.
 *
 * ⚠️ **ΜΗΝ φέρεις εδώ κρίση.** Αυτές οι συναρτήσεις **διαβάζουν**· δεν
 * αποφασίζουν αν επιτρέπεται (CHECK 3.68 · ADR-801).
 *
 * @module lib/auth/permissions/resource-lookups
 * @see lib/auth/permissions.ts — ο κριτής που τις καταναλώνει
 */

import { getAdminFirestore, isFirebaseAdminAvailable } from '@/lib/firebaseAdmin';
import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';

import type { AuthContext, ProjectMember, PropertyGrant } from '../types';
import { readProjectMember } from '../project-member-read';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('permissions');

/**
 * Request-scoped permission cache.
 * Pass this between checks in the same request to avoid duplicate Firestore reads.
 */
export interface PermissionCache {
  /** Cached project memberships by projectId */
  memberships: Map<string, ProjectMember | null>;
  /** Cached property grants by propertyId */
  grants: Map<string, PropertyGrant | null>;
}

// =============================================================================
// CACHE MANAGEMENT
// =============================================================================

/**
 * Create a new request-scoped permission cache.
 * Call this once per request and pass to all permission checks.
 *
 * @returns Empty permission cache
 *
 * @example
 * ```typescript
 * const cache = createPermissionCache();
 * const hasView = await hasPermission(ctx, 'projects:projects:view', { projectId }, cache);
 * const hasUpdate = await hasPermission(ctx, 'projects:projects:update', { projectId }, cache);
 * ```
 */
export function createPermissionCache(): PermissionCache {
  return {
    memberships: new Map(),
    grants: new Map(),
  };
}

// =============================================================================
// FIRESTORE ACCESS
// =============================================================================

/**
 * Get Firestore instance (ADR-077: Centralized via @/lib/firebaseAdmin).
 */
export function getDb(): Firestore | null {
  if (!isFirebaseAdminAvailable()) {
    return null;
  }
  return getAdminFirestore();
}

// =============================================================================
// MEMBERSHIP LOOKUP
// =============================================================================

/**
 * Get project membership for a user.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΖΗΤΟΥΣΕ **ΛΑΘΟΣ ΚΛΕΙΔΙ** — ΚΑΙ ΓΙ' ΑΥΤΟ ΠΛΕΟΝ ΠΑΡΑΠΕΜΠΕΙ (ADR-862 Φ0 Β7)
 * ─────────────────────────────────────────────────────────────────────────────
 * Μέχρι 2026-09-16 αυτή η συνάρτηση έκανε `.doc(ctx.uid).get()`. Ο **γραφέας**
 * όμως — η **μία** πόρτα γραφής μέλους — δημιουργεί
 * `members/{mbr_…}` με το `uid` ως **πεδίο** (N.6 + ADR-787 §5.1 γρ. 534), και ο
 * αδελφός αναγνώστης του καταλόγου το **ήξερε** (`data.uid ?? doc.id`).
 *
 * ⇒ Η αναζήτηση **δεν έβρισκε ΠΟΤΕ** μέλος που πέρασε από την πόρτα γραφής.
 * Fail-closed, άρα **καμία διαρροή** — αλλά κάθε κρίση ανά έργο ήταν **δομικά
 * νεκρή**, σιωπηλά, με κάθε πύλη πράσινη. Το σχήμα *«`0` = κανείς δεν κοίταξε»*.
 *
 * ✅ **Αλλαγή συμπεριφοράς σήμερα: ΜΗΔΕΝ, μετρημένα.** Στη ζωντανή βάση υπάρχουν
 * **0 έγγραφα μέλους σε 8/8 έργα** (μέτρηση 2026-09-16, ίδιο επιχείρημα με τη
 * μετονομασία του ADR-787 §5.1 α), και **ένας** καταναλωτής παραγωγής της
 * διαδρομής με `projectId` (`api/projects/[projectId]/landowner-unlink-check`).
 *
 * ⚠️ **ΤΟ ΣΥΜΒΟΛΑΙΟ ΠΡΟΣ ΤΟΝ `checkPermission` ΜΕΝΕΙ ΑΚΕΡΑΙΟ**: `ProjectMember |
 * null`. Ο θεματοφύλακας ξεχωρίζει *«δεν είναι μέλος»* από *«δεν ρωτήσαμε»*·
 * **εδώ** και τα δύο γίνονται `null`, όπως **πάντα** έκανε αυτή η συνάρτηση.
 * 🔑 Και αυτό είναι **σωστό γι' αυτόν τον καλούντα**: ο `checkPermission`
 * απαντά «επιτρέπεται;» και η μόνη ασφαλής απάντηση σε άγνοια είναι **όχι**. Η
 * διάκριση **δεν χάνεται** — ζει στον θεματοφύλακα, όπου ο κριτής ορατότητας του
 * Β7 τη **χρειάζεται** (ένα 503 «δεν μπόρεσα να ρωτήσω» δεν επιτρέπεται να
 * μεταμφιεστεί σε «δεν συμμετέχεις»).
 *
 * @param ctx - Auth context
 * @param projectId - Project ID
 * @param cache - Permission cache
 * @returns ProjectMember or null
 * @see lib/auth/project-member-read — ο ΕΝΑΣ αναγνώστης και η ΜΙΑ μετάφραση
 */
export async function getProjectMembership(
  ctx: AuthContext,
  projectId: string,
  cache: PermissionCache
): Promise<ProjectMember | null> {
  const cacheKey = `${projectId}:${ctx.uid}`;

  // Check cache first
  if (cache.memberships.has(cacheKey)) {
    return cache.memberships.get(cacheKey) ?? null;
  }

  // ⚠️ **Μία** απομνημόνευση, όχι δύο: κρατιέται το υπάρχον `PermissionCache`
  //    (ανά αίτημα) και ο θεματοφύλακας καλείται **χωρίς** δική του — δύο caches
  //    για το ίδιο έγγραφο είναι δύο απαντήσεις που μπορούν να αποκλίνουν.
  const read = await readProjectMember({
    companyId: ctx.companyId,
    projectId,
    uid: ctx.uid,
  });

  if (read.outcome === 'unknown' || read.outcome === 'unreadable') {
    // Το ίχνος το γράφει ήδη ο θεματοφύλακας· εδώ μένει η **τοπική** αιτία, ώστε
    // το μονοπάτι δικαιωμάτων να φαίνεται στα ερωτήματα παρατηρησιμότητας.
    // ⚠️ Και οι **δύο** καταστάσεις γίνονται `null` — «δεν ξέρω» και «δεν
    //    καταλαβαίνω» δίνουν την ίδια, μόνη ασφαλή απάντηση στο «επιτρέπεται;».
    logger.error('[PERMISSIONS] Failed to get project membership', {
      outcome: read.outcome,
      why: read.why,
    });
  }

  const membership = read.outcome === 'member' ? read.member : null;
  cache.memberships.set(cacheKey, membership);
  return membership;
}

// =============================================================================
// GRANT LOOKUP
// =============================================================================

/**
 * Get property grant for a user.
 *
 * @param ctx - Auth context
 * @param propertyId - Property ID
 * @param cache - Permission cache
 * @returns PropertyGrant or null
 */
export async function getPropertyGrant(
  ctx: AuthContext,
  propertyId: string,
  cache: PermissionCache
): Promise<PropertyGrant | null> {
  const cacheKey = `${propertyId}:${ctx.uid}`;

  // Check cache first
  if (cache.grants.has(cacheKey)) {
    return cache.grants.get(cacheKey) ?? null;
  }

  const db = getDb();
  if (!db) {
    cache.grants.set(cacheKey, null);
    return null;
  }

  try {
    // Path: /companies/{companyId}/properties/{propertyId}/grants/{uid}
    const grantDoc = await db
      .collection(COLLECTIONS.COMPANIES)
      .doc(ctx.companyId)
      .collection(SUBCOLLECTIONS.COMPANY_PROPERTIES)
      .doc(propertyId)
      .collection(SUBCOLLECTIONS.PROPERTY_GRANTS)
      .doc(ctx.uid)
      .get();

    if (!grantDoc.exists) {
      cache.grants.set(cacheKey, null);
      return null;
    }

    const grant = grantDoc.data() as PropertyGrant;
    cache.grants.set(cacheKey, grant);
    return grant;
  } catch (error) {
    logger.error('[PERMISSIONS] Failed to get property grant', { error });
    cache.grants.set(cacheKey, null);
    return null;
  }
}

