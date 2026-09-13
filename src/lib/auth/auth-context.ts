/**
 * @fileoverview Request Context Builder - RFC v6 Implementation
 * @version 1.0.0
 * @author Nestor Construct Platform
 * @since 2026-01-14
 *
 * Server-side request context builder that verifies Firebase ID tokens
 * and extracts RFC v6 custom claims for authorization decisions.
 *
 * Integration Notes:
 * - Uses existing Firebase Admin SDK initialization from admin-guards.ts
 * - Extends with RFC v6 requirements (companyId, globalRole, mfaEnrolled)
 * - Returns type-safe union: AuthContext | UnauthenticatedContext
 *
 * @see docs/rfc/authorization-rbac.md
 * @see src/server/admin/admin-guards.ts (existing auth patterns)
 */

import 'server-only';

import type { DecodedIdToken } from 'firebase-admin/auth';
import type { NextRequest } from 'next/server';

import type {
  AuthContext,
  UnauthenticatedContext,
  RequestContext,
  CustomClaims,
  PersonalIdentityContext,
} from './types';
// ADR-853 §14 — ο ΕΝΑΣ πίνακας «ρόλος × χώρος», κοινός με το `readPageIdentity`.
// ⛔ ΜΗΝ ξαναγράψεις εδώ `isValidGlobalRole(...)`: ο κανόνας ζούσε αντίγραφο και στους
//    δύο παραγωγούς, και **και οι δύο** διάβαζαν τον απόντα ρόλο ως άκυρο.
import { classifyIdentityClaims, type IdentityClaimsVerdict } from './identity-claims';
// ADR-801 §2.8 — ο ΕΝΑΣ αναγνώστης του claim `permissions`, κοινός με τον
// φυλλομετρητή. ⚠️ ΜΗΝ γράψεις εδώ δικό σου `Array.isArray(...)`: αυτό ακριβώς
// ήταν το σχήμα των τριών κανόνων που έκλεισε αυτή η φάση.
import { readPermissionsClaim } from './claim-permissions';
// ADR-821 — ο ΕΝΑΣ κριτής του «επιτρέπεται να κατασκευάσω ταυτότητα;». ⚠️ ΜΗΝ
// γράψεις εδώ δικό σου `process.env.NODE_ENV === 'development'`: αυτό ακριβώς ήταν
// το σχήμα των **έξι** κατασκευαστών σε **δύο** αποκλίνουσες διαλέκτους.
import { decideIdentityFabrication } from './identity-fabrication';
import { getDevCompanyId } from '@/config/dev-environment';
// 🔑 ADR-817 §4.1 — τα διαπιστευτήρια εξήχθησαν (N.7.1). Άλλη ευθύνη: «πώς παίρνω
// υπογεγραμμένο token;» έναντι «τι σημαίνει αυτό το token;».
import {
  extractBearerToken,
  extractSessionCookie,
  verifyIdToken,
  verifySessionCookie,
} from '@/lib/auth/token-credentials';
// 🎫 ADR-787 Κ-2 — το λεξιλόγιο του χώρου. Ο **κριτής** (`decideMembership`) και η
//    ανάγνωση της κεφαλίδας ζουν στο `auth-context-workspace.ts` (βλ. παρακάτω)· εδώ
//    μένει μόνο ο τύπος που ταξιδεύει ως δεδομένο μέχρι την πόρτα.
import type { RequestedWorkspace } from '@/types/workspace-membership';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('auth-context');

// 🔑 ADR-787 §5.3 ζ — «πού ενεργεί;» είναι ΑΛΛΗ ευθύνη από «ποιος είναι;» και ζει σε δικό
//    της αρχείο (N.7.1, εξαγωγή 2026-09-12 στις 500 γραμμές — καμία αλλαγή συμπεριφοράς).
//    ⛔ ΜΗΝ ξαναγράψεις εδώ ανάγνωση κεφαλίδας: η σειρά νέα→αποσυρόμενη είναι συμβόλαιο.
import {
  readDeclaredWorkspace,
  resolveEffectiveWorkspace,
} from './auth-context-workspace';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Unauthenticated context reasons for diagnostics.
 */
type UnauthReason = UnauthenticatedContext['reason'];

// =============================================================================
// FIREBASE ADMIN ACCESS (ADR-077: Centralized via @/lib/firebaseAdmin)
// =============================================================================

// =============================================================================
// CLAIMS EXTRACTION
// =============================================================================

/**
 * 🔑 **ΤΑ CLAIMS ΤΑΥΤΟΤΗΤΑΣ ΤΑ ΚΡΙΝΕΙ Ο ΕΝΑΣ ΤΑΞΙΝΟΜΗΤΗΣ** — `lib/auth/identity-claims.ts`,
 * κοινός με τον σελιδο-φρουρό (`server/auth/page-identity.ts`).
 *
 * 🔴 **ΤΙ ΖΟΥΣΕ ΕΔΩ ΜΕΧΡΙ 2026-09-13**: `extractIdentityClaims` + `extractCustomClaims`. Ο
 * πρώτος απέρριπτε ως `missing_claims` **και** τον **απόντα** ρόλο — δηλαδή τον νέο άνθρωπο
 * που **κανείς δεν είχε προλάβει** να του δώσει ρόλο. Αυτό έκλεινε τις **14** προσωπικές
 * διαδρομές (ανάμεσά τους την αποδοχή πρόσκλησης και την ίδρυση χώρου) ακριβώς στον
 * πληθυσμό για τον οποίο υπάρχουν (ADR-853 §14). Ο σελιδο-φρουρός είχε **αντίγραφο** του
 * ίδιου κανόνα — δύο παραγωγοί, ένας κανόνας γραμμένος δύο φορές (ADR-749).
 *
 * ⚠️ **ΤΑ ΔΥΟ ΣΥΜΒΟΛΑΙΑ ΜΕΝΟΥΝ ΑΚΕΡΑΙΑ, ΜΕΣΑ ΣΤΟΝ ΤΑΞΙΝΟΜΗΤΗ**:
 *   · ο **άκυρος** ρόλος κρίνεται **ΠΡΙΝ** τον χώρο (ADR-807 §3.4β) — αλλιώς token με
 *     άκυρο ρόλο και χωρίς `companyId` θα έβγαινε `personal`·
 *   · το `companyId.length === 0` είναι **απουσία**, όχι μισθωτής (ADR-657 §3.5).
 */

/**
 * Η **ΕΤΑΙΡΙΚΗ** ταυτότητα — `null` όταν ο ταξινομητής δεν βρήκε οργανισμό.
 *
 * ⚠️ **ΚΡΑΤΑ ΤΟ ΟΝΟΜΑ ΤΟΥ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ** (ADR-817 §7.2): το `lib/routes/landing.ts`
 * (παγωμένο) και άλλα αρχεία το επικαλούνται **ονομαστικά** ως πρότυπο του «κενή
 * συμβολοσειρά = απουσία». Ο κανόνας όμως **δεν** ζει πια εδώ — ζει στο
 * `classifyIdentityClaims`· αυτή η συνάρτηση μόνο **συναρμολογεί** ό,τι εκείνος έκρινε.
 * ⛔ ΜΗΝ ξαναγράψεις εδώ έλεγχο `companyId`/ρόλου: θα ήταν δεύτερη ερμηνεία του πίνακα.
 */
function extractCustomClaims(
  token: DecodedIdToken,
  verdict: IdentityClaimsVerdict,
): CustomClaims | null {
  if (verdict.kind !== 'organization') return null;

  return {
    companyId: verdict.companyId,
    globalRole: verdict.globalRole,
    mfaEnrolled: token.mfaEnrolled === true,
    emailVerified: token.email_verified === true,
    permissions: readPermissionsClaim(token.permissions),
  };
}

// =============================================================================
// MAIN CONTEXT BUILDER
// =============================================================================

/**
 * **ΤΡΕΙΣ ΡΗΤΕΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΠΟΤΕ BOOLEAN** — η ταυτότητα του αιτούντος στο σύνορο API.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 ΤΟ ΓΕΓΟΝΟΣ: «ΔΕΝ ΕΧΕΙΣ ΕΤΑΙΡΕΙΑ» ΔΙΑΒΑΖΟΤΑΝ ΩΣ «ΔΕΝ ΥΠΑΡΧΕΙΣ» — ΞΑΝΑ
 *
 * Το **ADR-807** διόρθωσε ακριβώς αυτό στον **σελιδο-φρουρό**. Το API layer έμεινε
 * πίσω: μέχρι τις 2026-08-26 η απουσία `companyId` έβγαινε `401` σε **κάθε** μία από
 * τις **319** διαδρομές `withAuth`. Ο πολίτης έμπαινε, προσγειωνόταν, **έβλεπε** τα
 * ακίνητά του — και **δεν μπορούσε να καταχωρήσει τίποτα** (ADR-660 §5.7).
 *
 * ⚠️ Και ο φραγμός ήταν **απόλυτος** για την αγγελία: το `firestore.rules` δίνει
 * `allow create: if false` στο `owner_properties` — **μόνο Admin SDK**. Δεν υπήρχε
 * παρακαμπτήριος από τον πελάτη, σε αντίθεση με τη **ζήτηση** (`property_demands`),
 * που ο πελάτης γράφει μόνος του και **δούλευε ήδη**.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ⛔ **ΜΗΝ ξαναφέρεις λόγο απόρριψης για την απουσία οργανισμού** — και μην τη
 *    μοντελοποιήσεις ως «εταιρεία με κενό id»: θα περνούσε ερωτήματα Firestore με
 *    κενό μισθωτή, που κυνηγά το **CHECK 3.35**.
 */
export type ApiIdentity =
  | { readonly ok: true; readonly scope: 'organization'; readonly ctx: AuthContext }
  | { readonly ok: true; readonly scope: 'personal'; readonly ctx: PersonalIdentityContext }
  | { readonly ok: false; readonly reason: UnauthReason };

/**
 * Turn an already-decoded token (from a Bearer ID token OR a __session cookie)
 * into an {@link ApiIdentity}. Both credential paths share this — decode differs, the
 * claims→identity steps are identical, so they live here once (N.18 anti-clone).
 */
async function identityFromDecodedToken(
  decodedToken: DecodedIdToken | null,
  request: NextRequest,
): Promise<ApiIdentity> {
  if (!decodedToken) {
    return { ok: false, reason: 'invalid_token' };
  }

  // ── ΒΗΜΑ 1: Η ΤΑΥΤΟΤΗΤΑ ────────────────────────────────────────────────────
  // ⚠️ **Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ, ΟΧΙ ΥΦΟΣ** (ADR-807 §3.4β): ο **άκυρος** ρόλος
  //    απορρίπτεται **ΠΡΙΝ** τον χώρο — μέσα στον ΕΝΑ ταξινομητή. Ο **απών** ρόλος δεν
  //    απορρίπτεται πια (ADR-853 §14): είναι ο νέος άνθρωπος, όχι cookie που δεν εμπιστευόμαστε.
  const verdict = classifyIdentityClaims(decodedToken);
  if (verdict.kind === 'rejected') {
    logger.warn('[AUTH_CONTEXT] DENY — claims ταυτότητας που δεν εξουσιοδοτούνται', {
      uid: decodedToken.uid,
      why: verdict.why,
      globalRole: decodedToken.globalRole,
    });
    return { ok: false, reason: 'missing_claims' };
  }

  // ── ΒΗΜΑ 1β: Η ΔΗΛΩΣΗ ΤΟΥ ΧΩΡΟΥ ───────────────────────────────────────────
  // 🔴 **ΚΑΚΟΣΧΗΜΑΤΙΣΜΕΝΗ ΔΗΛΩΣΗ ⇒ ΑΡΝΗΣΗ, ΠΟΤΕ ΠΡΟΕΠΙΛΟΓΗ** (OWASP multi-tenant:
  //    *«Fail closed if the tenant context is missing or invalid; do not fall back to an
  //    unscoped query»*). Μια τιμή που δεν καταλαβαίνουμε **δεν** επιτρέπεται να
  //    διαβαστεί ως «δεν δήλωσε τίποτα»: αυτή ακριβώς η ισοπέδωση ήταν η βλάβη.
  const reading = readDeclaredWorkspace(request);
  if (reading.outcome === 'malformed') {
    logger.warn('[AUTH_CONTEXT] DENY — κακοσχηματισμένη δήλωση χώρου', {
      uid: decodedToken.uid,
      detail: reading.detail,
    });
    return { ok: false, reason: 'workspace_malformed' };
  }
  // «Δεν δήλωσε» ⇒ `default`: **η ίδια** σημασιολογία που είχε πάντα η απουσία, τώρα με
  // όνομα. Η μέτρηση της απουσίας ζει στο {@link readDeclaredWorkspace}.
  const declared: RequestedWorkspace =
    reading.outcome === 'declared' ? reading.requested : { kind: 'default' };

  const base: PersonalIdentityContext = {
    uid: decodedToken.uid,
    email: decodedToken.email || '',
    // 🔑 `null` ⇒ κανείς δεν του έδωσε ακόμη ρόλο (ADR-853 §14) — νόμιμο **μόνο** στον
    //    προσωπικό κλάδο· ο εταιρικός τον αντικαθιστά παρακάτω με ρόλο **εγγυημένο**.
    globalRole: verdict.globalRole,
    mfaEnrolled: decodedToken.mfaEnrolled === true,
    isAuthenticated: true,
    permissions: readPermissionsClaim(decodedToken.permissions),
  };

  // ── ΒΗΜΑ 2: Ο ΧΩΡΟΣ — ΔΥΟ ΚΑΤΑΣΤΑΣΕΙΣ, ΚΑΜΙΑ ΑΠΟΤΥΧΙΑ ─────────────────────
  const claims = extractCustomClaims(decodedToken, verdict);
  if (!claims) {
    // ⚠️ Ο ΠΡΟΣΩΠΙΚΟΣ ΧΩΡΟΣ ΔΕΝ ΠΕΡΝΑ ΑΠΟ ΤΟΝ ΕΠΙΛΥΤΗ ΕΝΕΡΓΟΥ ΧΩΡΟΥ, ΚΑΙ ΕΙΝΑΙ
    //    ΣΚΟΠΙΜΟ: η κεφαλίδα `x-super-admin-company-id` ζητά **μετακίνηση σε άλλον
    //    οργανισμό**, και κάποιος χωρίς οργανισμό δεν έχει από πού να μετακινηθεί.
    //    Ένας πολίτης **δεν μπορεί δομικά** να ζητήσει ξένο χώρο από αυτή τη διαδρομή.
    return { ok: true, scope: 'personal', ctx: base };
  }

  const effective = await resolveEffectiveWorkspace(declared, claims, decodedToken.uid);
  if (!effective.ok) {
    return { ok: false, reason: effective.reason };
  }

  return {
    ok: true,
    scope: 'organization',
    ctx: {
      ...base,
      globalRole: claims.globalRole,
      companyId: effective.companyId,
      superAdminOverride: effective.overridden,
      membershipVerdict: effective.verdict,
      // 🔑 Η δήλωση **ταξιδεύει** μέχρι τη διαδρομή: εκεί απαντά το ερώτημα «ποιανού
      //    γραμμές δικαιούμαι να δω;» χωρίς κανείς να ξαναδιαβάσει κεφαλίδα (ADR-356 ·
      //    ADR-702 — δες `super-admin-scope.ts` και `tenant-scope.ts`).
      requestedWorkspace: declared,
    },
  };
}

/**
 * **Η ΜΙΑ ΜΗΧΑΝΗ ΤΑΥΤΟΤΗΤΑΣ ΤΟΥ ΣΥΝΟΡΟΥ API** (ADR-817 §4.1).
 *
 * 1. Bearer token από την κεφαλίδα `Authorization` (API clients)
 * 2. Cookie συνεδρίας `__session` (φυλλομετρητής, `credentials: 'include'`)
 * 3. Καμία πιστοποίηση — dev bypass ή απόρριψη
 *
 * ⚠️ **ΤΟ `buildRequestContext` ΕΙΝΑΙ ΚΑΤΑΝΑΛΩΤΗΣ ΤΗΣ, ΟΧΙ ΑΔΕΛΦΗ ΤΗΣ.** Δύο
 * ανεξάρτητοι παραγωγοί ταυτότητας στο ίδιο αρχείο θα ήταν **δύο απαντήσεις σε ένα
 * ερώτημα** — ADR-749, και μάλιστα στην πιο ακριβή του θέση.
 */
export async function buildApiIdentity(request: NextRequest): Promise<ApiIdentity> {
  // Step 1: Try Bearer token from Authorization header (API clients)
  const token = extractBearerToken(request);

  if (token) {
    return identityFromDecodedToken(await verifyIdToken(token), request);
  }

  // Step 2: Try session cookie (__session) — browser clients use credentials: 'include'
  const sessionCookie = extractSessionCookie(request);

  if (sessionCookie) {
    return identityFromDecodedToken(await verifySessionCookie(sessionCookie), request);
  }

  // Step 3: Καμία πιστοποίηση — **ΡΩΤΑ ΤΗΝ ΑΥΘΕΝΤΙΑ** (ADR-821), μη κρίνεις εδώ.
  //
  // 🔴 ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΠΙΑ `process.env.NODE_ENV === 'development'`: αυτή η γραμμή
  //    ήταν ο **ένας από τους έξι** κατασκευαστές, και ο **αυστηρός** από τις δύο
  //    διαλέκτους — ενώ ο αδελφός του `readPageIdentity` χρησιμοποιούσε την
  //    **επιεική**. Με `NODE_ENV` κενό οι δύο **αποκλίνουν**: η σελίδα αποδίδεται
  //    με ταυτότητα, το API απαντά 401 (ADR-821 §2.1).
  //
  // 🔴 ΚΑΙ ΕΙΝΑΙ Η ΓΡΑΜΜΗ ΤΟΥ ΠΕΡΙΣΤΑΤΙΚΟΥ (§2.7): ο `ensureDevUserProfile`
  //    καλούσε ανώνυμα μια διαδρομή με `requiredGlobalRoles`, και περνούσε **μόνο
  //    επειδή** εδώ γεννιόταν `company_admin`. Ο φρουρός δεν παρακάμφθηκε —
  //    **ικανοποιήθηκε**. Αποτέλεσμα: `users/dev-admin` με `super_admin` **στην
  //    παραγωγή**.
  const fabrication = decideIdentityFabrication();
  if (fabrication.verdict === 'granted-development-fallback') {
    logger.info('[AUTH_CONTEXT] Κατασκευασμένη ταυτότητα — καμία πιστοποίηση', {
      verdict: fabrication.verdict,
    });
    // Η κατασκευή **δίνει** companyId, άρα είναι εξ ορισμού εταιρική.
    return { ok: true, scope: 'organization', ctx: await createDevContext() };
  }

  logger.warn('[AUTH_CONTEXT] DENY — καμία πιστοποίηση, καμία κατασκευή', {
    verdict: fabrication.verdict,
    reason: fabrication.reason,
  });
  return { ok: false, reason: 'missing_token' };
}

/**
 * Build request context from NextRequest — **ο ΕΤΑΙΡΙΚΟΣ καταναλωτής** της
 * {@link buildApiIdentity}.
 *
 * 🔴 **ΓΙΑΤΙ ΙΣΟΠΕΔΩΝΕΙ ΤΟΝ ΠΡΟΣΩΠΙΚΟ ΧΩΡΟ ΣΕ 401** (ADR-817 §3): η **προεπιλογή**
 * είναι fail-closed. Το `AuthContext` **εγγυάται** μισθωτή, και το καταναλώνουν οι
 * **319** διαδρομές `withAuth`, η απομόνωση μισθωτή και τα `firestore.rules`. Μια
 * διαδρομή αποκτά προσωπική εμβέλεια **μόνο δηλώνοντάς το** — με το
 * `withPersonalOrOrgAuth`, ποτέ σιωπηλά.
 *
 * ⚠️ **ΜΗΔΕΝ ΑΛΛΑΓΗ ΣΥΜΠΕΡΙΦΟΡΑΣ**: ο άνθρωπος χωρίς οργανισμό έπαιρνε
 * `missing_claims` πριν το ADR-817, παίρνει `missing_claims` και μετά. Άλλαξε μόνο
 * ότι η κατάσταση απέκτησε **όνομα**.
 *
 * @param request - NextRequest object
 * @returns RequestContext (AuthContext | UnauthenticatedContext)
 *
 * @example
 * ```typescript
 * const ctx = await buildRequestContext(request);
 * if (!isAuthenticated(ctx)) {
 *   return NextResponse.json({ error: ctx.reason }, { status: 401 });
 * }
 * // ctx is now typed as AuthContext
 * const { uid, companyId, globalRole } = ctx;
 * ```
 */
export async function buildRequestContext(
  request: NextRequest
): Promise<RequestContext> {
  const identity = await buildApiIdentity(request);

  if (!identity.ok) {
    return createUnauthenticatedContext(identity.reason);
  }

  if (identity.scope === 'personal') {
    logger.warn('[AUTH_CONTEXT] DENY — missing companyId claim', { uid: identity.ctx.uid });
    return createUnauthenticatedContext('missing_claims');
  }

  // 🔴🔴 Ο ΙΔΙΩΤΙΚΟΣ ΧΩΡΟΣ ΔΕΝ ΕΧΕΙ ΕΤΑΙΡΕΙΑ — ΚΑΙ Η ΕΤΑΙΡΙΚΗ ΠΟΡΤΑ ΤΟ ΛΕΕΙ, ΑΝΤΙ ΝΑ
  //    ΜΑΝΤΕΨΕΙ (ADR-787 §5.3 ζ όριο 1 · ADR-809)
  //
  // Μέχρι τις 2026-09-12 ο ιδιωτικός χώρος έφτανε εδώ **αόρατος**: ο πελάτης δεν έστελνε
  // κεφαλίδα, ο διακομιστής διάβαζε την απουσία ως «κρίνε μόνος σου» και **προχωρούσε** —
  // για super-admin σε **καθολική όψη** (`super-admin-global`, όλη η συλλογή), για απλό
  // χρήστη στην εταιρεία του **claim**. Μετρημένο ζωντανά: `/o/me/projects` ⇒ «Έργα (7)».
  //
  // 🔑 **Η άρνηση είναι Η ΙΔΙΑ σχεδιασμένη κατάσταση με τον δρόμο της Firestore**: εκεί ο
  //    `resolveEffectiveWorkspace` του πελάτη πετά `MissingTenantError` (ADR-809) και κάθε
  //    καταναλωτής τη χειρίζεται **σιωπηλά και σωστά** ως άδειο αποτέλεσμα. Ο κωδικός
  //    `MISSING_TENANT` του `api-denial` είναι **η ίδια λέξη** στο σύρμα, ώστε ο πελάτης να
  //    μην χρειάζεται δεύτερο λεξιλόγιο για δεύτερη μεταφορά.
  //
  // ⚠️ **ΠΡΙΝ ΤΟΝ HANDLER, ΟΧΙ ΜΕΣΑ ΤΟΥ**: αν η κρίση ζούσε στη διαδρομή, θα χρειαζόταν
  //    **σε 276 αρχεία**, και **μία** παράλειψη φτάνει. Εδώ είναι μία.
  if (identity.ctx.requestedWorkspace?.kind === 'personal') {
    logger.info('[AUTH_CONTEXT] DENY — ιδιωτικός χώρος σε εταιρική διαδρομή', {
      uid: identity.ctx.uid,
    });
    return createUnauthenticatedContext('workspace_personal');
  }

  return identity.ctx;
}

/**
 * Create unauthenticated context with reason.
 *
 * @param reason - Unauthentication reason
 * @returns UnauthenticatedContext
 */
function createUnauthenticatedContext(reason: UnauthReason): UnauthenticatedContext {
  return {
    isAuthenticated: false,
    reason,
  };
}

// =============================================================================
// DEVELOPMENT HELPERS
// =============================================================================

/**
 * Η κατασκευασμένη ταυτότητα **σε σχήμα `AuthContext`** — προβολή, όχι απόφαση.
 *
 * ⚠️ **ΤΑ ΠΕΔΙΑ ΔΕΝ ΓΡΑΦΟΝΤΑΙ ΕΔΩ** (ADR-821 §4.3): έρχονται από το
 * `FABRICATED_PRINCIPAL`, που είναι η **μία** κατασκευασμένη αρχή. Καρφωμένα
 * `uid`/`globalRole` εδώ θα ήταν **δεύτερη** ταυτότητα δίπλα στην πρώτη — ακριβώς
 * το σχήμα των **τριών** κλιμακούμενων ταυτοτήτων που έκλεισε αυτό το ADR.
 *
 * ⛔ **Ο ΦΡΟΥΡΟΣ ΖΕΙ ΕΔΩ, ΟΧΙ ΣΤΟΝ ΚΑΛΟΥΝΤΑ** (belt-and-suspenders, N.7.2 #4): η
 * συνάρτηση είναι `export` και το `lib/auth/index.ts` τη διανέμει. Αν ο έλεγχος
 * έμενε μόνο στον καλούντα, κάθε νέος καλών θα τον ξανάγραφε — και **μία**
 * παράλειψη αρκεί. Ρωτά την **ίδια** αυθεντία με το `buildApiIdentity`, ποτέ
 * δικό της `NODE_ENV`.
 *
 * @param overrides - Partial AuthContext overrides
 * @returns AuthContext
 * @throws Αν η αυθεντία δεν επιτρέπει κατασκευή — με τον **λόγο** της.
 */
export async function createDevContext(overrides?: Partial<AuthContext>): Promise<AuthContext> {
  const fabrication = decideIdentityFabrication();
  if (fabrication.verdict !== 'granted-development-fallback') {
    throw new Error(
      `[AUTH_CONTEXT] createDevContext: ${fabrication.verdict} — ${fabrication.reason}`,
    );
  }

  const companyId = await getDevCompanyId();

  return {
    ...fabrication.principal,
    companyId,
    isAuthenticated: true,
    ...overrides,
  };
}

// =============================================================================
// RE-EXPORTS FOR CONVENIENCE
// =============================================================================

export type { RequestContext, AuthContext, UnauthenticatedContext };
export { isAuthenticated } from './types';
