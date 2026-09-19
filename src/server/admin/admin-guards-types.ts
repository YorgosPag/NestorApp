import 'server-only';

import { ADMINISTRATIVE_ROLES } from '@/lib/auth/roles';
import type { GlobalRole } from '@/lib/auth/types';
import type { WithAuthOptions } from '@/lib/auth/middleware';

/**
 * 🔐 ADMIN GUARDS — TYPES & CONSTANTS
 *
 * Extracted from admin-guards.ts (ADR-065 Phase 5)
 * Server-only types for authentication and authorization
 *
 * ⚠️ **ΤΟ ΛΕΞΙΛΟΓΙΟ ΡΟΛΩΝ ΔΕΝ ΓΕΝΝΙΕΤΑΙ ΕΔΩ** (ADR-813 Φάση Β). Εισάγεται από
 * το SSoT (`lib/auth/roles.ts` · `lib/auth/types.ts`). Χειρόγραφη τετράδα
 * ονομάτων έζησε εδώ μέχρι τις 2026-08-26, με **3 στα 4** ανύπαρκτα.
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Admin context returned after successful authentication
 */
export interface AdminContext {
  uid: string;
  email: string;
  role: AdminRole;
  operationId: string;
  environment: string;
  mfaEnrolled: boolean;
  companyId?: string; // 🏢 ENTERPRISE: Tenant isolation - from Firebase Auth custom claims
}

/**
 * User context returned after successful authentication (no admin role required)
 * @enterprise Used for endpoints that require authenticated users but not admin privileges
 */
export interface UserContext {
  uid: string;
  email: string;
  role: AdminRole | null;
  operationId: string;
  environment: string;
}

/**
 * User authentication result
 */
export interface UserAuthResult {
  success: boolean;
  error?: string;
  context?: UserContext;
}

/**
 * Ο ρόλος ενός διαχειριστή — **το ΙΔΙΟ λεξιλόγιο με τα claims** (ADR-813 Φάση Β).
 *
 * 🔴 **ΗΤΑΝ `'admin' | 'broker' | 'builder' | 'super_admin'` — ΤΡΙΑ ΣΤΑ ΤΕΣΣΕΡΑ
 *    ΟΝΟΜΑΤΑ ΔΕΝ ΥΠΑΡΧΟΥΝ ΠΟΥΘΕΝΑ.** Μετρημένο 2026-08-26 με AST: τα `admin` ·
 *    `broker` · `builder` **δεν** είναι ούτε στα `GLOBAL_ROLES` (το λεξιλόγιο
 *    των claims) ούτε στον `PREDEFINED_ROLES` (τον κατάλογο των 13 ρόλων).
 *    Μετρημένο και **ζωντανά στην παραγωγή**: **0 στους 5** λογαριασμούς έχει
 *    `globalRole` με τέτοιο όνομα.
 *
 * ⚠️ **ΤΟ ΙΔΙΟ ΕΛΑΤΤΩΜΑ ΗΤΑΝ ΗΔΗ ΔΙΑΓΝΩΣΜΕΝΟ — ΣΤΟ ΛΑΘΟΣ ΑΝΤΙΓΡΑΦΟ.** Το
 *    `lib/auth/security-policy.ts` το περιγράφει **κατά λέξη** («*δεν ήταν
 *    αδρανή — ήταν **ΔΟΛΩΜΑ*** … *ένα `isAdminRole('company_admin')` επέστρεφε
 *    `false`*») και το ADR-801 Φάση 3 το **αφαίρεσε από εκεί** — όπου είχε
 *    **μηδέν** καταναλωτές. Το **ταυτόσημο** λεξιλόγιο έμεινε **εδώ**, όπου
 *    φυλά **ολόκληρο το `/admin`**. *Καθαρίστηκε το αντίγραφο που δεν έβλαπτε.*
 *
 * 🔑 **Ο ΤΥΠΟΣ ΚΑΝΕΙ ΤΗ ΒΛΑΒΗ ΜΗ ΕΚΦΡΑΣΙΜΗ**: με `GlobalRole`, ένα
 *    `return 'admin'` **δεν μεταγλωττίζεται**. Δεν χρειάζεται να το θυμάται
 *    κανείς — και οι δύο νεκροί legacy κλάδοι του `hasAdminRole` έφυγαν
 *    ακριβώς επειδή ο μεταγλωττιστής τους απαγόρευσε.
 */
export type AdminRole = GlobalRole;

/**
 * Authentication result
 */
export interface AuthResult {
  success: boolean;
  error?: string;
  context?: AdminContext;
}

/**
 * Audit log entry structure
 */
export interface AuditEntry {
  timestamp: string;
  operationId: string;
  operation: string;
  environment: string;
  uid?: string;
  role?: AdminRole;
  details: Record<string, unknown>;
}

/**
 * Staff context returned after successful authentication
 * @enterprise EPIC Δ - Staff-only Inbox endpoints
 */
export interface StaffContext {
  uid: string;
  email: string;
  role: AdminRole;
  operationId: string;
  environment: string;
}

/**
 * Staff authentication result
 */
export interface StaffAuthResult {
  success: boolean;
  error?: string;
  context?: StaffContext;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Οι ρόλοι που περνούν το **ταβάνι** του `/admin` — **ΠΑΡΑΓΟΜΕΝΟΙ, ποτέ λίστα**.
 *
 * 🔑 **ΓΙΑΤΙ ΤΟ ΤΑΒΑΝΙ ΚΑΙ ΟΧΙ Ο ΚΡΙΤΗΣ** — η διάκριση είναι μετρημένη, όχι
 *    αισθητική. Το προφανές *«ρώτα `decideCapability({action:'admin_access'})`»*
 *    **απορρίφθηκε**: το `roles.ts` το προειδοποιεί ρητά, γιατί το claim μπορεί
 *    να κουβαλά `admin_access` ως **extra** και **τέτοιος χρήστης υπάρχει
 *    ζωντανά** (ADR-801 §2.6: `external_user` **+** `['admin_access']`). Το
 *    `/admin` είναι **ταβάνι πλατφόρμας**, δηλαδή *«ποιος ρόλος επιτρέπεται να
 *    δει αυτή την επιφάνεια;»* — **δεν αγοράζεται από το claim**.
 *
 * ⇒ Το σύνολο **παράγεται** από τον κατάλογο (`isBypass ∪ admin_access` =
 *   ακριβώς `{super_admin, company_admin}`) και το **επαναχρησιμοποιούμε
 *   αυτούσιο** — καμία δεύτερη λίστα, κανένα δεύτερο κριτήριο.
 *
 * 🏆 **ΚΑΙ ΕΙΝΑΙ Η ΠΡΑΚΤΙΚΗ ΤΩΝ ΜΕΓΑΛΩΝ**: το NIST SP 800-162 (ABAC) και το
 *    SP 800-207 (Zero Trust) ορίζουν ότι ο **PEP** *«contains **no clever logic
 *    of its own**»*, και ο κεντρικός PDP *«helps **avoid the duplication of role
 *    lists across multiple enforcement points**»*. Το ίδιο λέει το **AuthZEN
 *    Authorization API 1.0** (τελικό OpenID spec, 01/2026): ο PEP **ρωτά**, δεν
 *    κρίνει. Αυτό το αρχείο **ήταν** PEP με δική του λίστα.
 */
export const ADMIN_ROLES: readonly AdminRole[] = ADMINISTRATIVE_ROLES;

/**
 * 🔐 PR-1B: MFA ENFORCEMENT — **ίδιο σύνολο, ρητά**.
 *
 * ⚠️ Ήταν **δεύτερο χειρόγραφο αντίγραφο** της ίδιας τετράδας, δίπλα-δίπλα με
 * το πρώτο. Δύο λίστες που όφειλαν να συμφωνούν και **τίποτα δεν το επέβαλλε**
 * — το σχήμα που σε αυτό το repo έχει αποτύχει μετρημένα (CHECK 3.34: **63**
 * απόκλιση · 3.37: **18 vs 26** · 3.57: **19/20**).
 *
 * 🔑 Η ταύτιση είναι **σκόπιμη και δηλωμένη**: *κάθε* ρόλος που βλέπει το
 * `/admin` οφείλει MFA. Αν ποτέ χρειαστεί να αποκλίνουν, θα είναι **απόφαση**
 * με δικό της σύνολο — όχι σιωπηλή απόκλιση δύο αντιγράφων.
 */
const MFA_REQUIRED_ROLES: readonly AdminRole[] = ADMINISTRATIVE_ROLES;

/** Check if a role requires MFA enrollment */
export function roleRequiresMfa(role: AdminRole): boolean {
  return MFA_REQUIRED_ROLES.includes(role);
}

/**
 * 🔐 **Η πολιτική της κονσόλας `/admin` για τις διαδρομές API** — η δίδυμη του
 * `requireAdminForPage` (ADR-868).
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ**: η σελίδα `/admin/ai-inbox` έκρινε *ρόλο διαχειριστή + MFA*, ενώ οι
 *    πράξεις της ήταν server actions που δεν έκριναν **τίποτα** — δέχονταν `companyId` και
 *    `adminUid` από τον πελάτη. *Η σελίδα φύλαγε, το endpoint όχι.* Η Next.js το λέει
 *    ρητά: *«A page-level authentication check does not extend to the Server Actions
 *    defined within it»*.
 *
 * 🔑 **ΙΔΙΟ ΣΥΝΟΛΟ, ΟΧΙ ΑΝΤΙΓΡΑΦΟ**: ρόλοι = `ADMIN_ROLES` (το ίδιο ταβάνι με τη σελίδα) και
 *    MFA **πάντα**, επειδή `MFA_REQUIRED_ROLES` **είναι** `ADMINISTRATIVE_ROLES` — η ταύτιση
 *    είναι δηλωμένη παραπάνω. Αν ποτέ αποκλίνουν, αυτή η σταθερά πρέπει να γίνει συνάρτηση
 *    του ρόλου, όχι δεύτερη λίστα.
 *
 * ⚠️ Νέος πίνακας (`[...]`) επειδή το `requiredGlobalRoles` του `withAuth` δηλώνεται
 *    μεταβλητός· το ταβάνι μένει παγωμένο.
 */
export const ADMIN_SURFACE_AUTH = Object.freeze({
  requiredGlobalRoles: [...ADMIN_ROLES],
  requireMfa: true,
}) satisfies WithAuthOptions;

// ============================================================================
// SERVER-ONLY COLLECTIONS (ZERO HARDCODED STRINGS IN ROUTES)
// ============================================================================

/**
 * Server-only Firestore collection names
 * These collections should NEVER be imported in client code
 * Routes MUST use these constants instead of hardcoded strings
 */
export const SERVER_COLLECTIONS = {
  /** Admin building templates - source of truth for seed/populate */
  ADMIN_BUILDING_TEMPLATES: 'admin_building_templates',
  /** Buildings collection - main buildings data */
  BUILDINGS: 'buildings',
  /** Audit logs */
  AUDIT_LOGS: 'audit_logs',
} as const;

export type ServerCollectionKey = keyof typeof SERVER_COLLECTIONS;
