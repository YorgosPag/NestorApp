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
  GlobalRole,
  CustomClaims,
  PersonalIdentityContext,
} from './types';
import { isValidGlobalRole } from './types';
// ADR-801 §2.8 — ο ΕΝΑΣ αναγνώστης του claim `permissions`, κοινός με τον
// φυλλομετρητή. ⚠️ ΜΗΝ γράψεις εδώ δικό σου `Array.isArray(...)`: αυτό ακριβώς
// ήταν το σχήμα των τριών κανόνων που έκλεισε αυτή η φάση.
import { readPermissionsClaim } from './claim-permissions';
import { getDevCompanyId } from '@/config/dev-environment';
// 🔑 ADR-817 §4.1 — τα διαπιστευτήρια εξήχθησαν (N.7.1). Άλλη ευθύνη: «πώς παίρνω
// υπογεγραμμένο token;» έναντι «τι σημαίνει αυτό το token;».
import {
  extractBearerToken,
  extractSessionCookie,
  verifyIdToken,
  verifySessionCookie,
} from '@/lib/auth/token-credentials';
// 🎫 ADR-787 Κ-2 — ο ΕΝΑΣ απαντητής του «είναι μέλος;».
// ⚠️ Το `isRoleBypass` έφυγε από εδώ επίτηδες: ο έλεγχος ρόλου έπαψε να είναι
//    *η απόφαση* και έγινε **μία από τις επτά ετυμηγορίες** μέσα στον απαντητή
//    (`platform-bypass`). Δεύτερος έλεγχος ρόλου εδώ θα ήταν δεύτερη αυθεντία.
import { decideMembership } from '@/lib/auth/workspace-membership';
import { isAllowed, orgWorkspace, type MembershipVerdict } from '@/types/workspace-membership';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('auth-context');

const SUPER_ADMIN_COMPANY_HEADER = 'x-super-admin-company-id';

/**
 * Το αποτέλεσμα του *«σε ποιον χώρο ενεργεί αυτό το αίτημα;»*.
 *
 * ⚠️ Διακριτή ένωση, **όχι** `{ companyId, overridden }` με «ασφαλή» επιστροφή
 * στον χώρο του token σε περίπτωση άρνησης. Η σιωπηλή επιστροφή θα ήταν
 * ακριβώς η βλάβη που απέρριψε το **ADR-787 Ε-5 §7**: *«δύο καρτέλες μαλώνουν
 * σιωπηλά — αλλάζεις χώρο στη μία, η άλλη αρχίζει να **γράφει αλλού** χωρίς να
 * το πει»*. Σε εργαλείο όπου ανεβαίνουν **παραδόσεις μελετών**, αυτό είναι
 * λάθος φάκελος, και η **αρχή Α4 #3** λέει πού καταλήγει.
 * ⇒ Αίτημα που ονομάζει χώρο όπου δεν επιτρέπεσαι **δεν εξυπηρετείται αλλού·
 *   απορρίπτεται**.
 */
type WorkspaceResolution =
  | {
      readonly ok: true;
      readonly companyId: string;
      readonly overridden: boolean;
      readonly verdict: MembershipVerdict;
    }
  | { readonly ok: false; readonly reason: 'workspace_forbidden' | 'workspace_unavailable' };

/**
 * 🔴 ΤΟ ΣΗΜΕΙΟ ΟΠΟΥ Ο ΔΙΑΚΟΜΙΣΤΗΣ ΑΠΟΦΑΣΙΖΕΙ (ADR-787 Κ-2 · Ε-5)
 *
 * Μέχρι 2026-08-22 αυτή η συνάρτηση ρωτούσε **τον ρόλο** (`isRoleBypass`) και
 * μετά δεχόταν **οποιαδήποτε** τιμή κεφαλίδας — δηλαδή *«ο πελάτης ζητά → ο
 * διακομιστής **επικυρώνει τον ρόλο**»*, όχι *«→ αποφασίζει»*. Ο έλεγχος
 * *«είναι μέλος;»* **δεν υπήρχε πουθενά στην πλατφόρμα** (ADR-787 §5.1 α #3).
 *
 * Πλέον ρωτά τον **έναν** απαντητή. Είναι το **μοναδικό** σημείο επέμβασης:
 * ζει μέσα στο `buildRequestContext`, που ζει μέσα στο `withAuth`, που
 * χρησιμοποιούν **352 αρχεία διαδρομών**.
 *
 * ⚠️ Η κεφαλίδα **δεν γενικεύεται** εδώ σε όλους τους ρόλους: το **Ε-5 §5**
 * αποφάσισε ότι ο μεταφορέας γίνεται η **διεύθυνση** (Φάση 3) — μια κεφαλίδα
 * είναι αόρατη, δεν στέλνεται σε σύνδεσμο, και δεν ξεχωρίζει δύο καρτέλες.
 * Άλλαξε **ποιος απαντά** πίσω της, όχι ποιος επιτρέπεται να ρωτήσει.
 */
async function resolveEffectiveCompanyId(
  request: NextRequest,
  claims: CustomClaims,
  uid: string,
): Promise<WorkspaceResolution> {
  const requestedId = request.headers.get(SUPER_ADMIN_COMPANY_HEADER);

  // Κανένα αίτημα για άλλον χώρο ⇒ ο χώρος του υπογεγραμμένου token.
  // ⚡ **Μηδέν αναγνώσεις** — η συνήθης περίπτωση κάθε αιτήματος (Ε-5 §2).
  if (!requestedId || requestedId === claims.companyId) {
    return { ok: true, companyId: claims.companyId, overridden: false, verdict: 'home' };
  }

  const decision = await decideMembership({
    uid,
    claimCompanyId: claims.companyId,
    globalRole: claims.globalRole,
    requested: orgWorkspace(requestedId),
  });

  if (isAllowed(decision.verdict)) {
    logger.info('[AUTH_CONTEXT] Ενεργός χώρος διαφορετικός από το token — επιτράπηκε', {
      uid, original: claims.companyId, requested: requestedId, verdict: decision.verdict,
    });
    return { ok: true, companyId: requestedId, overridden: true, verdict: decision.verdict };
  }

  // ⚠️ Η αιτία κρατιέται **στα ίχνη ακέραιη** (`not-a-member` vs `suspended` vs
  //    `unknown`)· προς τα **έξω** φεύγει μόνο η αδιάκριτη μορφή της.
  logger.warn('[AUTH_CONTEXT] Ενεργός χώρος διαφορετικός από το token — απορρίφθηκε', {
    uid, original: claims.companyId, requested: requestedId, verdict: decision.verdict,
  });

  return {
    ok: false,
    reason: decision.verdict === 'unknown' ? 'workspace_unavailable' : 'workspace_forbidden',
  };
}

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
 * Τα claims της **ΤΑΥΤΟΤΗΤΑΣ** — ό,τι απαντά στο *«ποιος είσαι;»*, **χωρίς τον χώρο**.
 *
 * 🔑 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΕ ΑΠΟ ΤΟΝ ΧΩΡΟ** (ADR-817 §4.1): μέχρι τις 2026-08-26 τα δύο
 * ερωτήματα ζούσαν σε **μία** συνάρτηση, οπότε η απάντηση *«δεν έχω γραφείο»* έβγαινε
 * ως *«δεν είσαι κανείς»* — **κατηγοριακό λάθος**, ακριβώς αυτό που το ADR-807 §3.3
 * είχε ήδη διορθώσει έναν όροφο πιο πάνω, στον σελιδο-φρουρό.
 *
 * ⚠️ **Ο ΡΟΛΟΣ ΕΙΝΑΙ ΤΑΥΤΟΤΗΤΑ, ΟΧΙ ΧΩΡΟΣ**, και γι' αυτό κρίνεται **εδώ**: άκυρος
 * ρόλος σημαίνει cookie που δεν εμπιστευόμαστε, και **πρέπει** να απορριφθεί
 * ανεξάρτητα από το αν ο άνθρωπος έχει γραφείο (ADR-807 §3.4β). Με την αντίστροφη
 * σειρά, token με **άκυρο ρόλο** και **χωρίς** `companyId` θα έβγαινε `personal` —
 * δηλαδή η διόρθωση της γραφής θα **χαλάρωνε την ασφάλεια, σιωπηλά**.
 */
type IdentityClaims = Omit<CustomClaims, 'companyId'>;

function extractIdentityClaims(token: DecodedIdToken): IdentityClaims | null {
  const globalRoleRaw = token.globalRole as string | undefined;
  if (typeof globalRoleRaw !== 'string' || !isValidGlobalRole(globalRoleRaw)) {
    logger.warn('[AUTH_CONTEXT] DENY — missing/invalid globalRole claim', {
      uid: token.uid,
      globalRole: globalRoleRaw,
    });
    return null;
  }

  return {
    globalRole: globalRoleRaw as GlobalRole,
    // MFA enrollment is optional
    mfaEnrolled: token.mfaEnrolled === true,
    // Email verified is optional (from standard Firebase claims)
    emailVerified: token.email_verified === true,
    // ADR-801 §2.8 — το ρητό κανάλι παραχώρησης. Δηλωνόταν στο `CustomClaims`
    // από την αρχή και **κανείς δεν το διάβαζε εδώ**, οπότε ο `checkPermission`
    // έκρινε μόνο από τον ρόλο και το claim πεταγόταν. Ο αναγνώστης είναι
    // **ένας**, κοινός με τον φυλλομετρητή — αλλιώς η άγκυρα ισοδυναμίας θα
    // σύγκρινε άλλη είσοδο.
    permissions: readPermissionsClaim(token.permissions),
  };
}

/**
 * Extract RFC v6 custom claims from decoded token — **η ΕΤΑΙΡΙΚΗ ταυτότητα**.
 *
 * ⚠️ **ΑΠΟΡΡΙΠΤΕΙ fail-closed το `companyId.length === 0`** (ADR-657 §3.5) — *«κενή
 * συμβολοσειρά = **απουσία**, όχι μισθωτής»*. Ο κανόνας αυτός αναφέρεται **ονομαστικά**
 * ως πρότυπο από το `lib/routes/landing.ts` και το `lib/auth/authority.ts`, και μένει
 * **ακέραιος**.
 *
 * 🔴 **ΑΛΛΑΞΕ ΤΙ ΣΗΜΑΙΝΕΙ Η ΑΡΝΗΣΗ ΤΟΥ, ΟΧΙ ΤΟ ΚΡΙΤΗΡΙΟ ΤΟΥ** (ADR-817): το `null`
 * **δεν** είναι πλέον «δεν είσαι» — είναι **«δεν έχεις οργανισμό»**, δηλαδή ο
 * **προσωπικός** κλάδος. Για τις **319** διαδρομές που περνούν από το
 * {@link buildRequestContext} το αποτέλεσμα παραμένει **ταυτόσημο** (401 με
 * `missing_claims`)· αλλάζει μόνο ότι η κατάσταση απέκτησε **όνομα** και υπάρχει
 * **μία** πόρτα που μπορεί να τη δει ({@link buildApiIdentity}).
 *
 * ⚠️ Δέχεται τα claims ταυτότητας **ως όρισμα** και δεν τα ξαναβγάζει: αλλιώς η ίδια
 * ερώτηση θα απαντιόταν **δύο φορές** στην ίδια διαδρομή εκτέλεσης.
 */
function extractCustomClaims(
  token: DecodedIdToken,
  identity: IdentityClaims,
): CustomClaims | null {
  const companyId = token.companyId as string | undefined;
  if (typeof companyId !== 'string' || companyId.length === 0) {
    return null;
  }

  return { ...identity, companyId };
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
  // ⚠️ **Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ, ΟΧΙ ΥΦΟΣ** (ADR-807 §3.4β): ο ρόλος κρίνεται
  //    **ΠΡΙΝ** τον χώρο.
  const identity = extractIdentityClaims(decodedToken);
  if (!identity) {
    return { ok: false, reason: 'missing_claims' };
  }

  const base: PersonalIdentityContext = {
    uid: decodedToken.uid,
    email: decodedToken.email || '',
    globalRole: identity.globalRole,
    mfaEnrolled: identity.mfaEnrolled ?? false,
    isAuthenticated: true,
    permissions: identity.permissions,
  };

  // ── ΒΗΜΑ 2: Ο ΧΩΡΟΣ — ΔΥΟ ΚΑΤΑΣΤΑΣΕΙΣ, ΚΑΜΙΑ ΑΠΟΤΥΧΙΑ ─────────────────────
  const claims = extractCustomClaims(decodedToken, identity);
  if (!claims) {
    // ⚠️ Ο ΠΡΟΣΩΠΙΚΟΣ ΧΩΡΟΣ ΔΕΝ ΠΕΡΝΑ ΑΠΟ ΤΟΝ ΕΠΙΛΥΤΗ ΕΝΕΡΓΟΥ ΧΩΡΟΥ, ΚΑΙ ΕΙΝΑΙ
    //    ΣΚΟΠΙΜΟ: η κεφαλίδα `x-super-admin-company-id` ζητά **μετακίνηση σε άλλον
    //    οργανισμό**, και κάποιος χωρίς οργανισμό δεν έχει από πού να μετακινηθεί.
    //    Ένας πολίτης **δεν μπορεί δομικά** να ζητήσει ξένο χώρο από αυτή τη διαδρομή.
    return { ok: true, scope: 'personal', ctx: base };
  }

  const effective = await resolveEffectiveCompanyId(request, claims, decodedToken.uid);
  if (!effective.ok) {
    return { ok: false, reason: effective.reason };
  }

  return {
    ok: true,
    scope: 'organization',
    ctx: {
      ...base,
      companyId: effective.companyId,
      superAdminOverride: effective.overridden,
      membershipVerdict: effective.verdict,
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

  // Step 3: No credentials found — development bypass or reject
  if (process.env.NODE_ENV === 'development') {
    logger.info('[AUTH_CONTEXT] Development mode: bypassing API auth (no token or cookie)');
    // Το dev bypass **κατασκευάζει** companyId, άρα είναι εξ ορισμού εταιρικό.
    return { ok: true, scope: 'organization', ctx: await createDevContext() };
  }

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
 * Create a mock authenticated context for development/testing.
 * NEVER use in production!
 *
 * @param overrides - Partial AuthContext overrides
 * @returns AuthContext
 */
export async function createDevContext(overrides?: Partial<AuthContext>): Promise<AuthContext> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[AUTH_CONTEXT] createDevContext cannot be used in production');
  }

  const companyId = await getDevCompanyId();

  return {
    uid: 'dev-user',
    email: 'dev@localhost',
    companyId,
    globalRole: 'company_admin',
    mfaEnrolled: false,
    isAuthenticated: true,
    ...overrides,
  };
}

// =============================================================================
// RE-EXPORTS FOR CONVENIENCE
// =============================================================================

export type { RequestContext, AuthContext, UnauthenticatedContext };
export { isAuthenticated } from './types';
