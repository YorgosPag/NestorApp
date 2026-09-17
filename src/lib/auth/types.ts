/**
 * Authorization Types - RFC v6 Implementation
 * @see docs/rfc/authorization-rbac.md
 */

import type { MembershipVerdict, RequestedWorkspace } from "@/types/workspace-membership";
// ⚠️ **ΜΟΝΟ ΤΥΠΟΣ, ΚΑΙ ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΟΥ ΕΠΙΤΡΕΠΕΤΑΙ**: το
//    `@/types/container-access` εισάγει `PermissionId` από **εδώ**, άρα σε χρόνο
//    εκτέλεσης θα ήταν κύκλος. Το `import type` **σβήνεται** στη μεταγλώττιση
//    (`verbatimModuleSyntax`), οπότε δεν γεννιέται ακμή — ίδιο ιδίωμα με το
//    `services/iso19650/container-transition-policy.ts`, που εισάγει **και** τα δύο
//    αρχεία ως τύπους. ⛔ ΜΗΝ το κάνεις κανονικό `import`: το CHECK 3.80 μετρά
//    ακριβώς τον κύκλο που **σκάει** σε αρχικοποίηση (μάθημα `role-catalogue.ts`).
import type { CdeAudience } from "@/types/container-access";
import type { ProjectMemberEnrollment } from "@/types/project-member-enrollment";

// =============================================================================
// GLOBAL ROLES (Coarse-grained, stored in Custom Claims)
// =============================================================================

/** Global roles array - Single source of truth. */
export const GLOBAL_ROLES = [
  "super_admin", // Break-glass, system-wide access
  "company_admin", // Company management
  "internal_user", // Internal staff
  "external_user", // Customers, partners
] as const;

/**
 * Global roles — stored in Firebase Custom Claims.
 */
export type GlobalRole = (typeof GLOBAL_ROLES)[number];

// =============================================================================
// PROJECT ROLES (Fine-grained, stored in Firestore)
// =============================================================================

/**
 * Project roles determine per-project access level.
 * Stored in /projects/{projectId}/members/{uid}
 */
export type ProjectRole =
  | "project_manager"
  | "architect"
  | "engineer"
  | "site_manager"
  | "accountant"
  | "sales_agent"
  | "data_entry"
  | "viewer"
  | "vendor"; // External suppliers

// =============================================================================
// PERMISSION REGISTRY (Compile-time Safety) — Pattern: domain:resource:action
// =============================================================================

export const PERMISSIONS = {
  // Communications
  "comm:conversations:list": true,
  "comm:conversations:view": true,
  "comm:conversations:update": true,
  "comm:messages:view": true,
  "comm:messages:send": true,
  "comm:messages:delete": true,

  // Projects
  "projects:projects:view": true,
  "projects:projects:create": true,
  "projects:projects:update": true,
  "projects:projects:delete": true,
  "projects:members:view": true,
  "projects:members:manage": true,
  "projects:floors:view": true,
  "projects:floors:delete": true,

  // Properties (ADR-269) + legacy unit aliases (parking/storage)
  "properties:properties:view": true, "properties:properties:create": true,
  "properties:properties:update": true, "properties:properties:delete": true,
  "units:units:view": true, "units:units:create": true,
  "units:units:update": true, "units:units:delete": true,

  // Buildings (Phase 2 - first vertical slice)
  "buildings:buildings:view": true,
  "buildings:buildings:create": true,
  "buildings:buildings:update": true,
  "buildings:buildings:delete": true,

  // DXF
  "dxf:files:view": true,
  "dxf:files:upload": true,
  "dxf:layers:view": true,
  "dxf:layers:manage": true,
  "dxf:layers:unlock": true, // ADR-344 Q8 — unlock locked layers to write
  "dxf:annotations:edit": true,
  // ADR-344 text engine — TEXT/MTEXT entity permissions
  "dxf:text:create": true,
  "dxf:text:edit": true,
  "dxf:text:delete": true,
  // ADR-344 Phase 8 — custom dictionary (company-scoped spell-check terms)
  "dxf:dictionary:view": true,
  "dxf:dictionary:manage": true,

  // ═══════════════════════════════════════════════════════════════════════════
  // ISO 19650 — ΟΙ ΤΕΣΣΕΡΙΣ ΟΝΟΜΑΣΜΕΝΕΣ ΠΡΑΞΕΙΣ ΤΟΥ ΔΟΧΕΙΟΥ (ADR-862 Φ0 Β6)
  // ═══════════════════════════════════════════════════════════════════════════
  // Η κατάσταση CDE είναι **ΠΡΑΞΗ, όχι πεδίο** (AIP-216 output-only): αλλάζει
  // μόνο μέσα από αυτές τις τέσσερις, ποτέ με ελεύθερο dropdown. Πριν τη Φ0 ήταν
  // dropdown — δηλαδή ο φρουρός της ορατότητας άνοιγε με **ένα κλικ**.
  //
  // 🔴 Η ΙΚΑΝΟΤΗΤΑ ΔΕΝ ΑΡΚΕΙ ΓΙΑ ΤΗ ΣΦΡΑΓΙΔΑ, ΚΑΙ ΕΙΝΑΙ ΣΚΟΠΙΜΟ: ο έλεγχος
  //    `actor.uid === createdBy` ζει στον γραφέα (`iso19650/container-transitions.ts`)
  //    και **δεν** περνά από τον `decideCapability` — είναι **ιδιοκτησία**, όχι
  //    εξουσιοδότηση. Ούτε ο `super_admin` δεν σφραγίζει ξένη μελέτη· ο νόμος δεν
  //    έχει bypass ρόλο (ADR-862 §5.4.1.γ — 50-state survey σφραγίδων μηχανικού).
  //
  // 🔑 Η **προ-εξουσιοδότηση** του Ε-12 (*«ο συντονιστής δίνει εκ των προτέρων σε
  //    ονομασμένο μελετητή και τα δύο βήματα»*, πρότυπο «Approver» του ACC)
  //    εκφράζεται **ΜΟΝΟ** δίνοντας το `iso19650:containers:release` στο claim
  //    `permissions` εκείνου του ανθρώπου — ⛔ ποτέ με ωμή λίστα ρόλων (CHECK 3.68).
  "iso19650:containers:share": true,
  "iso19650:containers:seal": true,
  "iso19650:containers:release": true,
  "iso19650:containers:withdraw": true,
  // 🔑 ADR-862 Φ0 Β10 — η **πέμπτη**: νέα έκδοση παίρνει τη θέση της παλιάς. Κατά
  //    Aconex/Procore/Autodesk Docs είναι δικαίωμα **όποιου ανεβάζει**, όχι του συντονιστή —
  //    γι' αυτό ΔΕΝ είναι το `withdraw`. Η ικανότητα **δεν αρκεί**: ο γραφέας απαιτεί και
  //    **απόδειξη διαδοχής** (ίδιο δοχείο · ίδιος μισθωτής · δικός σου διάδοχος).
  "iso19650:containers:supersede": true,

  // CRM
  "crm:contacts:view": true,
  "crm:contacts:create": true,
  "crm:contacts:update": true,
  "crm:contacts:delete": true,
  "crm:contacts:export": true,
  // CRM - Opportunities (ADR-029 Global Search v1 Phase 2)
  "crm:opportunities:view": true,
  "crm:opportunities:create": true,
  "crm:opportunities:update": true,
  // CRM - Communications (ADR-029 Global Search v1 Phase 2)
  "crm:communications:view": true,
  // CRM - Tasks (ADR-029 Global Search v1 Phase 2)
  "crm:tasks:view": true,
  "crm:tasks:create": true,
  "crm:tasks:update": true,

  // Notifications
  "notifications:notifications:view": true,

  // Finance
  "finance:invoices:view": true,
  "finance:invoices:update": true,
  "finance:invoices:approve": true,

  // Legal
  "legal:documents:view": true,
  "legal:ownership:view": true,
  "legal:ownership:manage": true,
  "legal:grants:view": true,
  "legal:grants:create": true,
  "legal:grants:revoke": true,
  "legal:contracts:view": true,

  // Listings
  "listings:listings:publish": true,

  // Users & Settings
  "users:users:view": true,
  "users:users:manage": true,
  "settings:settings:view": true,
  "settings:settings:manage": true,

  // Admin access (legacy permission ID)
  admin_access: true,

  // Admin & System Operations
  "admin:migrations:execute": true,
  "admin:data:fix": true, // Data correction operations (fix incorrect data)
  "admin:direct:operations": true, // Direct database operations (bypass normal flows)
  "admin:debug:read": true, // Debug utilities (read-only inspection)
  "admin:system:configure": true, // System configuration (webhooks, integrations)
  "admin:backup:execute": true, // Backup & restore operations (ADR-313)

  // Reports
  "reports:reports:view": true,
  "reports:reports:create": true,

  // Search (Global Search v1)
  "search:global:execute": true,

  // Photos & Progress
  "photos:photos:upload": true,
  "progress:progress:update": true,

  // Floorplans
  "floorplans:floorplans:process": true,

  // Orders (for vendors)
  "orders:orders:view": true,
  "deliveries:deliveries:view": true,
  "specs:specs:view": true,

  // BIM 3D Dimensions (ADR-366 Phase 9 / C.3) — manual 3D dimensions tool
  "bim_dimensions_3d:dimensions:create": true,
  "bim_dimensions_3d:dimensions:read": true,
  "bim_dimensions_3d:dimensions:update": true,
  "bim_dimensions_3d:dimensions:delete": true,

  // BIM Comments / Markup (ADR-366 Phase 9 / C.2) — typed comment markers
  "bim_comments:comments:create": true,
  "bim_comments:comments:read": true,
  "bim_comments:comments:update": true,
  "bim_comments:comments:delete": true,
  "bim_comments:comments:assign": true,
  "bim_comments:comments:archive": true,

  // BIM Animations (ADR-366 Phase 9 / C.1.a) — camera animation configs + render jobs
  "bim_animations:animations:create": true,
  "bim_animations:animations:read": true,
  "bim_animations:animations:update": true,
  "bim_animations:animations:delete": true,

  // BIM Performance Telemetry (ADR-366 §C.7.Q3) — super-admin read-only
  "bim_performance_telemetry:telemetry:read": true,

  // Asset Packs (ADR-655) — gated content libraries (2D entourage, textures, symbols…).
  // ΕΝΑ permission για ΟΛΑ τα packs — ΟΧΙ ένα ανά pack: το PermissionId είναι στατικό
  // (`keyof typeof PERMISSIONS`), άρα permission-ανά-pack θα απαιτούσε edit εδώ + σε roles.ts
  // + deploy για ΚΑΘΕ νέο πακέτο. Η ταυτότητα του pack ζει στα ΔΕΔΟΜΕΝΑ (registry +
  // company entitlements), όχι στον τύπο. Αυτό εδώ απαντά μόνο: «ποιος ΧΡΗΣΤΗΣ μέσα στην
  // εταιρεία επιτρέπεται να χρησιμοποιεί πακέτα περιεχομένου;»
  "asset_packs:packs:use": true,

  // BIM Performance Diagnostics Triage (ADR-366 §C.7.Q2) — super-admin only
  // (granted via isBypass; explicit entries kept for audit transparency)
  "performance_diagnostics:diagnostics:triage": true,
  "performance_diagnostics:diagnostics:update_status": true,
  "performance_diagnostics:diagnostics:assign": true,
} as const;

/** Permission ID derived from registry. */
export type PermissionId = keyof typeof PERMISSIONS;

// =============================================================================
// GRANT SCOPES (For Property Delegation)
// =============================================================================

/** Grant Scopes — permissions delegated to external users via property grants. */
export const GRANT_SCOPES = {
  "unit:read_basic": true,
  "unit:docs:view_basic": true,
  "unit:dxf:view": true,
  "unit:status:view": true,
  "unit:messages:view": true,
  "legal:documents:view": true,
  "legal:contracts:view": true,
} as const;

/** Grant Scope ID for unit-level delegation. */
export type GrantScope = keyof typeof GRANT_SCOPES;

// =============================================================================
// AUDIT TYPES → ./audit-types.ts (ADR-655: το types.ts έφτασε το όριο των 500 γραμμών, N.7.1)
// =============================================================================
// Re-export ⇒ κάθε υπάρχον import από @/lib/auth/types δουλεύει αμετάβλητο.
// Ο ΟΡΙΣΜΟΣ ζει σε ΕΝΑ σημείο: ./audit-types.ts.
export { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from './audit-types';
export type {
  AuditAction,
  AuditTargetType,
  AuditChangeValue,
  AuditMetadata,
  AuditLogEntry,
} from './audit-types';


// =============================================================================
// CUSTOM CLAIMS CONTRACT
// =============================================================================

/** Firebase Custom Claims structure. */
export interface CustomClaims {
  /** Tenant anchor - required for multi-tenant isolation */
  companyId: string;
  /** Coarse access level */
  globalRole: GlobalRole;
  /** MFA enrollment status (NOT session verification) */
  mfaEnrolled?: boolean;
  /** Email verification status */
  emailVerified?: boolean;
  /**
   * Fine-grained permissions (optional).
   *
   * ⚠️ `readonly` από το ADR-801 §2.8: η **μόνη** νόμιμη πηγή είναι ο
   * `readPermissionsClaim`, που επιστρέφει παγωμένο πίνακα. Μεταβλητός τύπος
   * εδώ θα καλούσε τον επόμενο να τον «συμπληρώσει» με `push` — δηλαδή να
   * γεννήσει τέταρτο κανόνα ανάγνωσης, ακριβώς ό,τι έκλεισε αυτή η φάση.
   */
  permissions?: readonly PermissionId[];
}

// =============================================================================
// AUTH CONTEXT (Request-Scoped)
// =============================================================================

/** Authenticated request context (from Firebase ID token). */
export interface AuthContext {
  uid: string;
  email: string;
  companyId: string;
  globalRole: GlobalRole;
  mfaEnrolled: boolean;
  isAuthenticated: true;
  /**
   * ADR-354 entry point #6 — true when `companyId` was overridden by the
   * super-admin switcher header. Routes use this to scope admin endpoints
   * to the effective company instead of returning cross-tenant data.
   */
  superAdminOverride?: boolean;

  /**
   * **Γιατί** επιτρέπεται αυτός ο άνθρωπος σε αυτόν τον χώρο (ADR-787 Κ-2).
   *
   * ⚠️ Δεν είναι διακοσμητικό: χωρίς αυτό, ένα `companyId` στο context δεν λέει
   * **αν** κρίθηκε ή **απλώς αντιγράφηκε από το claim** — και αυτή ακριβώς η
   * σύγχυση ήταν το κενό που έκλεισε το Κ-2 (το §2.8 διάβασε το σχήμα ως
   * απόφαση). Με τη ρητή ετυμηγορία, η αιτία **ταξιδεύει** μέχρι τα ίχνη.
   *
   * Πάντα μία από τις **επιτρεπτικές** (`home` · `self` · `platform-bypass` ·
   * `member`) — οι αρνητικές δεν φτάνουν ποτέ εδώ, γιατί δεν παράγουν
   * `AuthContext`.
   */
  membershipVerdict?: MembershipVerdict;

  /**
   * **Ποιον χώρο ΔΗΛΩΣΕ το αίτημα** (ADR-787 §5.3 ζ όριο 1, 2026-09-12).
   *
   * 🔴 **Γιατί δεν αρκούσε το `superAdminOverride`**, και τι κόστισε: εκείνο είναι αληθές
   * **μόνο** όταν ο δηλωμένος χώρος **διαφέρει** από το claim. Άρα ένας super-admin μέσα
   * στο **δικό του** `/o/<εταιρεία>` έδινε `overridden: false`, και τα δόγματα λίστας το
   * διάβαζαν ως «δεν ζήτησε τίποτα» ⇒ **καθολική όψη όλων των εταιρειών** κάτω από
   * διεύθυνση που ονομάζει **μία**. Η ερώτηση που χρειάζονται δεν είναι *«άλλαξε
   * εταιρεία;»* αλλά ***«ονόμασε κάποιος εταιρεία;»***.
   *
   * ⚠️ **Απουσία σημαίνει «το αίτημα δεν δήλωσε χώρο»** — δηλαδή ακριβώς η σημερινή
   * συμπεριφορά (claim ή, για super-admin, καθολική όψη). Είναι **προαιρετικό επίτηδες**:
   * υπάρχουν νόμιμοι κατασκευαστές context που δεν προέρχονται από αίτημα HTTP (ο
   * κατασκευασμένος dev principal, οι εσωτερικές κλήσεις υπηρεσιών) και δεν έχουν
   * **τίποτα** να δηλώσουν. ⛔ ΜΗΝ το κάνεις υποχρεωτικό «για αυστηρότητα»: θα ανάγκαζε
   * αυτούς τους κατασκευαστές να **επινοήσουν** δήλωση, δηλαδή να πουν ψέματα.
   *
   * 🔑 Ο **ιδιωτικός** χώρος δεν φτάνει ποτέ σε διαδρομή με αυτό το πεδίο: τον αρνείται
   * το `buildRequestContext` **πριν** τον handler (`workspace_personal`). Αν τον δεις εδώ,
   * κάποιος έχει παρακάμψει το σύνορο.
   */
  requestedWorkspace?: RequestedWorkspace;

  /**
   * Οι **ρητά δοσμένες** ικανότητες του claim (ADR-801 §2.8, Φάση 3γ).
   *
   * 🔴 **Γιατί δεν υπήρχε, και τι κόστισε**: το `CustomClaims.permissions`
   * δηλωνόταν από την αρχή (γρ. 256) και ο `claims-handler.ts:159` το γράφει
   * **επίτηδες** ως `rolePermissions ∪ ρητά extras ∪ {admin_access}` — δηλαδή
   * είναι **κανάλι παραχώρησης**. Το `AuthContext` όμως δεν το κουβαλούσε, άρα
   * ο `checkPermission` έκρινε **αποκλειστικά** από `globalRole` και το ρητό
   * claim **πεταγόταν**. Μετρημένο σε πραγματικό χρήστη (`pagonis.oe@gmail.com`:
   * `external_user` + `['admin_access']`): πελάτης ✅ `granted-by-permission`,
   * server ⛔ `permission_not_in_role` ⇒ **το UI έδειχνε κουμπί που ο server θα
   * απέρριπτε**.
   *
   * ⚠️ **ΕΙΝΑΙ ΠΑΡΑΧΩΡΗΣΗ ΣΕ ΕΜΒΕΛΕΙΑ ΕΤΑΙΡΕΙΑΣ — ΟΧΙ ΑΝΑ ΠΟΡΟ.** Γράφεται
   * δίπλα στο `companyId` και **δεν κουβαλά** δική του εμβέλεια (σε αντίθεση με
   * το scope της ανάθεσης στο Azure RBAC ή το `Resource` του AWS IAM). Άρα
   * απαντά **μόνο** στο ερώτημα χωρίς πόρο. Ερώτημα με `projectId`/`propertyId`
   * το κρίνει η **συμμετοχή στο έργο** — όπως ακριβώς και τα permissions του
   * ρόλου, τα οποία αυτό το claim **περιέχει**. Αν κληρονομούσε προς τα κάτω,
   * το **ίδιο** permission id θα συμπεριφερόταν αλλιώς ανάλογα με τη διαδρομή
   * παράδοσης (ρόλος ή claim) — δύο απαντήσεις σε ένα ερώτημα, ADR-749 ξανά.
   *
   * ⚠️ **Απουσία (`undefined`) ≠ κενό (`[]`)**: το πρώτο λέει *«το token δεν
   * φέρει το κανάλι»*, το δεύτερο *«το φέρει, και είναι άδειο»*.
   */
  permissions?: readonly PermissionId[];
}

/**
 * **Η ταυτότητα ανθρώπου ΧΩΡΙΣ ΟΡΓΑΝΙΣΜΟ** — ό,τι και το {@link AuthContext},
 * **χωρίς** `companyId` και χωρίς τα δύο πεδία που έχουν νόημα μόνο μέσα σε χώρο.
 *
 * 🔑 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟΣ ΤΥΠΟΣ ΚΑΙ ΟΧΙ `companyId: string | null`** (ADR-807 §5 #4,
 * ADR-817 §4.3): το `AuthContext` το καταναλώνουν **352** διαδρομές, η απομόνωση
 * μισθωτή και τα `firestore.rules`. Χαλαρώνοντας **εκείνον** τον τύπο, κάθε σημείο
 * που σήμερα **εγγυάται** μισθωτή θα δεχόταν σιωπηλά `null` — δηλαδή θα πληρώναμε
 * μια διόρθωση **γραφής** με **διεύρυνση της επιφάνειας ασφαλείας**. Εδώ γίνεται το
 * αντίθετο: ο προσωπικός χώρος **δεν μπορεί δομικά** να περάσει εκεί όπου απαιτείται
 * `companyId` — το απαγορεύει ο **μεταγλωττιστής**, ανά έκφραση.
 *
 * ⚠️ **ΖΕΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟΝ ΠΑΡΑΓΩΓΟ ΤΟΥ** (Boy Scout, N.0.2): τον χρειάζονται **δύο**
 * παραγωγοί ταυτότητας — ο σελιδο-φρουρός (`server/auth/page-identity.ts`, ADR-807)
 * και το σύνορο API (`lib/auth/auth-context.ts`, ADR-817). Δεύτερος ορισμός θα ήταν
 * δύο λεξιλόγια για ένα ερώτημα, δηλαδή ADR-749 σε μικρογραφία.
 */
export type PersonalIdentityContext = Omit<
  AuthContext,
  // ⚠️ Το `requestedWorkspace` φεύγει **μαζί** τους, και για τον ίδιο λόγο: είναι η
  //    απάντηση στο *«σε ποια ΕΤΑΙΡΕΙΑ ενεργώ;»*, ερώτηση που για τον άνθρωπο χωρίς
  //    οργανισμό δεν έχει νόημα. Η δήλωσή του κρίνεται στο σύνορο, δεν ταξιδεύει μαζί του.
  'companyId' | 'superAdminOverride' | 'membershipVerdict' | 'requestedWorkspace' | 'globalRole'
> & {
  /**
   * 🔑 **`null` = ΚΑΝΕΙΣ ΔΕΝ ΤΟΥ ΕΔΩΣΕ ΡΟΛΟ — νόμιμη κατάσταση, ΟΧΙ άκυρη** (ADR-853 §14).
   *
   * Ο νέος άνθρωπος συνδέεται χωρίς claim ρόλου· τον ρόλο τον δίνει η **αποδοχή πρόσκλησης**
   * ή η **ίδρυση χώρου** — που περνούν **ακριβώς** από αυτή την ταυτότητα. Αν εδώ απαιτούνταν
   * ρόλος, οι δύο πράξεις θα ήταν δομικά ανέφικτες (κυκλική εξάρτηση, μετρημένη ζωντανά).
   *
   * ⚠️ **Ρητό `null`, ποτέ προαιρετικό πεδίο**: ο μεταγλωττιστής αναγκάζει κάθε καταναλωτή
   * να χειριστεί την απουσία. ⛔ Το `AuthContext` **δεν** χαλαρώνει: ο εταιρικός χώρος
   * εγγυάται ρόλο (`classifyIdentityClaims` ⇒ `workspace-without-role`).
   */
  globalRole: GlobalRole | null;
};

/** Unauthenticated context with reason. */
export interface UnauthenticatedContext {
  isAuthenticated: false;
  /**
   * ⚠️ Αυτή η τιμή **φεύγει στο σύρμα** (`details.reason` του 401). Κάθε νέα
   * τιμή πρέπει να είναι **αδιάκριτη** ως προς την ύπαρξη ξένου χώρου —
   * αλλιώς η άρνηση γίνεται **όργανο απαρίθμησης** (ADR-787 Ε-5 §4 #1).
   *
   * - `workspace_forbidden`  — ζήτησες χώρο στον οποίο δεν μπορείς να ενεργήσεις.
   *   ⚠️ Δεν μαρτυρά **αν υπάρχει**: ο απαντητής δίνει την ίδια ετυμηγορία
   *   (`not-a-member`) και όταν ο χώρος δεν υπάρχει και όταν υπάρχει χωρίς εσένα —
   *   γιατί και στις δύο περιπτώσεις **λείπει το ίδιο έγγραφο**. Η συγκάλυψη
   *   είναι **δομική**, όχι πρόσθετη.
   * - `workspace_unavailable` — **δεν μπορέσαμε να ρωτήσουμε.**
   *   ⛔ ΜΗΝ το συγχωνεύσεις με το προηγούμενο: *άγνωστο ≠ κενό* (N.12 ·
   *   ADR-787 Ε-5 §4 #3). Το ένα λέει «όχι», το άλλο «δεν ξέρω».
   * - `workspace_personal` — **δήλωσες τον ιδιωτικό σου χώρο σε διαδρομή που απαιτεί
   *   εταιρεία** (ADR-787 §5.3 ζ όριο 1, 2026-09-12). Δεν είναι αποτυχία ταυτότητας και
   *   **δεν είναι άρνηση**: είναι η **σχεδιασμένη κατάσταση** του ADR-809 («δεν ανήκεις
   *   σε εταιρεία»), ειπωμένη στη γλώσσα του HTTP. Γι' αυτό βγαίνει με τον κωδικό
   *   `MISSING_TENANT` — **την ίδια λέξη** με τον δρόμο της Firestore.
   * - `workspace_malformed` — **δήλωσες κάτι που δεν καταλαβαίνω.**
   *   ⛔ ΜΗΝ το ισοπεδώσεις σε «δεν δήλωσες»: το πρώτο είναι σφάλμα πελάτη (400), το
   *   δεύτερο είναι η σημερινή, νόμιμη σιωπή. Η ισοπέδωση των δύο είναι το σχήμα του N.12
   *   — και ήταν **ακριβώς** η ρίζα αυτού του ορίου.
   */
  reason:
    | "missing_token"
    | "invalid_token"
    | "missing_claims"
    | "workspace_forbidden"
    | "workspace_unavailable"
    | "workspace_personal"
    | "workspace_malformed";
}

/** Union type for request context. */
export type RequestContext = AuthContext | UnauthenticatedContext;

// =============================================================================
// COMPANY MEMBERSHIP (ADR-244: Role Management — Source of Truth for RBAC)
// =============================================================================
// =============================================================================
// PROJECT MEMBERSHIP
// =============================================================================

/** Project member document (stored in /projects/{pid}/members/{uid}). */
export interface ProjectMember {
  /** Duplicated for Firestore rules efficiency */
  companyId: string;
  /** Duplicated for Firestore rules efficiency */
  projectId: string;
  /** Role ID reference */
  roleId: string;
  /** Additional permission set IDs */
  permissionSetIds: string[];
  /** Precomputed effective permissions (updated by backend) */
  effectivePermissions: PermissionId[];
  /** Audit fields */
  addedAt: Date;
  addedBy: string;

  // ===========================================================================
  // ISO 19650 — Η ΟΜΑΔΑ ΚΑΙ ΤΟ ΑΚΡΟΑΤΗΡΙΟ (ADR-862 Φ0 Β7)
  // ===========================================================================
  /**
   * 🔑 **Η ΟΜΑΔΑ ΕΡΓΑΣΙΑΣ — «ο ρόλος λέει ΤΙ ΜΠΟΡΕΙ, η ομάδα λέει ΤΙΝΟΣ ΕΙΝΑΙ».**
   *
   * Το ISO 19650 ορίζει το WIP αυτολεξεί ως *«information being developed by its
   * originator or **task team**, not visible to or accessible by anyone else»* ⇒ η
   * ορατότητα του WIP κρίνεται από **αυτό** το πεδίο, ποτέ από ρόλο: δύο
   * στατικοί μηχανικοί από **δύο διαφορετικά γραφεία** φοράνε τον **ίδιο** ρόλο
   * `engineer` και **δεν** επιτρέπεται να βλέπουν το WIP ο ένας του άλλου.
   *
   * ⚠️ **`taskTeamId`, ΟΧΙ `team`/`teamId`**: το `COLLECTIONS.TEAMS` υπάρχει ήδη
   * και χρησιμοποιείται (`firestore-collections.ts:348`) — και το repo έχει **ήδη
   * πληρώσει** ομωνυμία σε αυτό το ακριβώς δέντρο (`COMPANY_MEMBERS === 'members'`,
   * §947-964: μέλος **ΕΝΟΣ έργου** επιστρεφόταν ως μέλος **ΟΛΟΥ του γραφείου**,
   * σιωπηλά, με κάθε πύλη πράσινη). Το όνομα είναι **μηχανισμός**, όχι γούστο.
   *
   * ⛔ **ΠΟΤΕ παραγόμενο από `disciplineCode`/`StudyGroup`** — τα γράφει ο AI με
   * `confidence`. *Εξουσιοδότηση από AI είναι εξουσιοδότηση που κανείς δεν
   * υπέγραψε.* Ο κλάδος μελέτης απαντά *«τι είδος σχεδίου»*, όχι *«ποιανού»*.
   *
   * ⚠️ **Απόν ⇒ `null` στο υποκείμενο, ΠΟΤΕ «ταιριάζει με το κενό»**: αρχείο
   * χωρίς ομάδα **και** άνθρωπος χωρίς ομάδα δίνουν `denied-teamless`
   * (`lib/auth/container-access.ts:247`), αλλιώς η **απουσία δεδομένου θα ήταν
   * άδεια**.
   */
  taskTeamId?: string;
  /**
   * Το **πρότυπο συμμετοχής** του στην υπόθεση (ADR-862 §5.4.1) — ποιες
   * καταστάσεις τον **φτάνουν** καθόλου.
   *
   * ⚠️ **Απόν ⇒ `'design'`** — δηλωμένο όριο 3 του σχεδίου Φ0. Ασφαλές **σήμερα**
   * (μετρημένα: μόνο εσωτερικοί, **0** έγγραφα μέλους στη ζωντανή βάση),
   * **επικίνδυνο** μόλις η Φ1 γράψει το πρώτο `engagement` — γι' αυτό η άγκυρα
   * της Φ1 γεννιέται **μαζί** της.
   *
   * 🔴 **Η ΑΠΟΥΣΙΑ ΤΟΥ ΕΓΓΡΑΦΟΥ ΕΙΝΑΙ ΑΛΛΟ ΠΡΑΓΜΑ**: «μέλος χωρίς δηλωμένο
   * ακροατήριο» ⇒ `'design'`· «δεν υπάρχει έγγραφο μέλους» ⇒ `audience: null` ⇒
   * `denied-not-engaged`. Ισοπέδωση των δύο θα έδινε πρόσβαση μελετητή σε
   * **οποιονδήποτε** δεν είναι μέλος.
   */
  cdeAudience?: CdeAudience;
  /**
   * **Γιατί είναι μέλος** — `creator` · `manual` · `backfill` (ADR-862 Φ0 Β14).
   * ℹ️ Πληροφορία για τον έλεγχο πρόσβασης, **όχι** εξουσιοδότηση: κανένας κριτής δεν τη διαβάζει.
   * Απούσα = γραμμένο πριν το Β14.
   */
  enrollment?: ProjectMemberEnrollment;
}

// =============================================================================
// PROPERTY OWNERSHIP & GRANTS
// =============================================================================

/** Property owner document (stored in /properties/{pid}/owners/{uid}). */
export interface PropertyOwner {
  /** Duplicated for rules validation */
  companyId: string;
  /** Duplicated for rules validation */
  projectId: string;
  /** Duplicated for rules validation */
  propertyId: string;
  /** Audit fields */
  addedAt: Date;
  addedBy: string;
  notes?: string;
}

/** Property grant document (stored in /properties/{pid}/grants/{granteeUid}). */
export interface PropertyGrant {
  /** Duplicated for rules validation */
  companyId: string;
  /** Duplicated for rules validation */
  projectId: string;
  /** Duplicated for rules validation */
  propertyId: string;
  /** Delegated scopes */
  scopes: GrantScope[];
  /** Required expiration */
  expiresAt: Date;
  /** Audit fields */
  createdAt: Date;
  createdBy: string;
  reason: string;
  /** Revocation (if revoked) */
  revokedAt?: Date;
  revokedBy?: string;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/** Type guard — is context authenticated? */
export function isAuthenticated(ctx: RequestContext): ctx is AuthContext {
  return ctx.isAuthenticated === true;
}

/**
 * Type guard — is string a valid PermissionId?
 *
 * ⚠️ **`Object.hasOwn` και ΟΧΙ `in`** (ADR-801 §2.9). Το `in` απαντά `true` για
 * **κάθε** ιδιότητα του prototype — `'toString'`, `'constructor'`, `'valueOf'`.
 * Μετρημένη συνέπεια πριν τη διόρθωση: το `checkPermission(ctx, 'toString')`
 * περνούσε το βήμα (1) και ο `super_admin` έπαιρνε **✅ από το bypass**, ενώ ο
 * `decideCapability` — που χρησιμοποιούσε ήδη σωστά το `Object.hasOwn` —
 * απαντούσε ⛔ `denied-unknown-action`. Δηλαδή **fail-open στον server**, και
 * ακριβώς το σχήμα που το §4.2 ονομάζει *το χειρότερο είδος σφάλματος*: το
 * τυπογραφικό δούλευε **για όποιον μπορεί να το διορθώσει** και αποτύγχανε
 * σιωπηλά για όλους τους άλλους.
 */
export function isValidPermission(
  permission: string,
): permission is PermissionId {
  return Object.hasOwn(PERMISSIONS, permission);
}

/** Type guard — is string a valid GrantScope? (ίδιος λόγος με το παραπάνω) */
export function isValidGrantScope(scope: string): scope is GrantScope {
  return Object.hasOwn(GRANT_SCOPES, scope);
}

/** Type guard — is string a valid GlobalRole? */
export function isValidGlobalRole(role: string): role is GlobalRole {
  return (GLOBAL_ROLES as readonly string[]).includes(role);
}
