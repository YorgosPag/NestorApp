/**
 * @fileoverview Tenant Configuration — Per-collection tenant isolation mapping
 * @description Static map defining which field each collection uses for tenant isolation (ADR-214 Phase 1)
 * @version 1.0.0
 * @created 2026-03-12
 */

import type { CollectionKey } from '@/config/firestore-collections';
import type { TenantFieldConfig, TenantIsolationMode } from './firestore-query.types';

// ============================================================================
// TENANT FIELD CONFIGURATION MAP
// ============================================================================

/**
 * Explicit overrides for collections that do NOT use the default `companyId` field.
 *
 * - `tenantId` collections: multi-tenant enterprise config services
 * - `userId` collections: per-user data (notifications, preferences)
 * - `none`: system-level singletons / shared data (no tenant filter)
 *
 * Every CollectionKey NOT listed here defaults to `{ mode: 'companyId', fieldName: 'companyId' }`.
 */
const TENANT_OVERRIDES: Partial<Record<CollectionKey, TenantFieldConfig>> = {
  // --- tenantId collections ---
  TEAMS:            { mode: 'tenantId', fieldName: 'tenantId' },
  ROLES:            { mode: 'tenantId', fieldName: 'tenantId' },
  USER_PREFERENCES: { mode: 'tenantId', fieldName: 'tenantId' },
  WORKSPACES:       { mode: 'companyId', fieldName: 'companyId' },
  WORKSPACE_MEMBERS:{ mode: 'companyId', fieldName: 'companyId' },
  PERMISSIONS:      { mode: 'tenantId', fieldName: 'tenantId' },

  // --- userId collections ---
  NOTIFICATIONS:              { mode: 'userId', fieldName: 'userId' },
  USER_NOTIFICATION_SETTINGS: { mode: 'userId', fieldName: 'userId' },
  // 🎯 ADR-777 Α9 — Η ΖΗΤΗΣΗ. Επίπεδο Β (SPEC-777A §14.2, που ονομάζει ρητά τις
  // «ζητήσεις» στο ιδιωτικό επίπεδο) — αλλά ανήκει σε ΑΝΘΡΩΠΟ, όχι σε εταιρεία, γιατί
  // ο ιδιώτης που ψάχνει σπίτι δεν έχει καμία. Το `authorCompanyId` του εγγράφου είναι
  // ΑΠΟΔΟΣΗ (ποιο γραφείο το κατέγραψε), ΟΧΙ δεύτερο πεδίο απομόνωσης: δύο άξονες
  // απομόνωσης για ένα έγγραφο σημαίνει δύο απαντήσεις στο «ποιος το βλέπει;».
  PROPERTY_DEMANDS:           { mode: 'userId', fieldName: 'authorUserId' },
  // 🎯 ADR-777 Α14 — Η ΠΡΟΣΦΟΡΑ ΤΟΥ ΙΔΙΩΤΗ. Το ΚΑΤΟΠΤΡΟ της παραπάνω γραμμής, και ο
  // λόγος είναι ο ΙΔΙΟΣ: το ακίνητο που δηλώνει ένας άνθρωπος για τον εαυτό του ανήκει
  // σε ΑΥΤΟΝ, όχι σε εταιρεία — γιατί ο ιδιώτης δεν έχει καμία.
  // ⚠️ ΔΕΝ υπάρχει δεύτερο πεδίο απομόνωσης (π.χ. `listedByCompanyId`) και ΔΕΝ πρέπει
  // να προστεθεί: δύο άξονες απομόνωσης για ένα έγγραφο σημαίνει δύο απαντήσεις στο
  // «ποιος το βλέπει;» — ο ίδιος κανόνας που γράφτηκε τρεις γραμμές πιο πάνω.
  OWNER_PROPERTIES:           { mode: 'userId', fieldName: 'ownerUserId' },

  // --- system (no tenant filter) ---
  // ⚠️ Το `unscopedReason` ΔΕΝ είναι σχόλιο: ο τύπος `TenantFieldConfig` το απαιτεί
  // (SPEC-777A §14.4 κανόνας 3). Νέα εγγραφή `mode: 'none'` χωρίς αυτό ΔΕΝ χτίζει.
  SYSTEM:           { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Καθολικές ρυθμίσεις πλατφόρμας — ίδιες για κάθε μισθωτή.' },
  CONFIG:           { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Καθολική διαμόρφωση εφαρμογής — δεν ανήκει σε μισθωτή.' },
  NAVIGATION:       { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Δομή πλοήγησης της εφαρμογής — κοινή σε όλους.' },
  SETTINGS:         { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Ρυθμίσεις επιπέδου πλατφόρμας.' },
  COUNTERS:         { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Μετρητές ακολουθιών· το κλειδί εγγράφου φέρει ήδη την εμβέλεια.' },
  ESCO_CACHE:       { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Κρυφή μνήμη δημόσιας ταξινομίας ESCO — δημόσιο δεδομένο τρίτου.' },
  ESCO_SKILLS_CACHE:{ mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Κρυφή μνήμη δημόσιας ταξινομίας ESCO — δημόσιο δεδομένο τρίτου.' },
  AI_CHAT_HISTORY:  { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Το ιστορικό φέρει δική του εμβέλεια στο κλειδί εγγράφου.' },
  AUDIT:            { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Ίχνος ελέγχου· φιλτράρεται στους κανόνες Firestore, όχι στο ερώτημα.' },
  TRANSLATIONS:     { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Μεταφράσεις διεπαφής — κοινές σε όλους τους μισθωτές.' },
  LOCALES:          { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Κατάλογος γλωσσών — κοινός σε όλους.' },
  SECURITY_ROLES:            { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Ορισμοί ρόλων πλατφόρμας (ADR-702) — κοινό λεξιλόγιο.' },
  EMAIL_DOMAIN_POLICIES:     { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Πολιτικές τομέα email σε επίπεδο πλατφόρμας.' },
  COUNTRY_SECURITY_POLICIES: { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Πολιτικές ασφαλείας ανά χώρα — κοινές σε όλους.' },

  // --- DXF / CAD Viewer (no tenant filter — files are project-scoped) ---
  CAD_FILES:              { mode: 'none', fieldName: '', unscopedCategory: 'project-scoped', unscopedReason: 'Τα αρχεία CAD ανήκουν σε έργο· η απομόνωση γίνεται μέσω του έργου.' },
  DXF_OVERLAY_LEVELS:     { mode: 'none', fieldName: '', unscopedCategory: 'project-scoped', unscopedReason: 'Επίπεδα επικάλυψης δεμένα σε αρχείο CAD, όχι σε μισθωτή.' },
  PROJECT_FLOORPLANS:     { mode: 'none', fieldName: '', unscopedCategory: 'project-scoped', unscopedReason: 'Κατόψεις δεμένες σε έργο· η απομόνωση γίνεται μέσω του έργου.' },

  // --- ADR-777 Α11/Α12 επίπεδο Α: ΚΟΙΝΟ ΦΥΣΙΚΟ ΓΕΓΟΝΟΣ -----------------------
  // 🔴 ΔΕΝ είναι «ξεχασμένο companyId» — είναι ρητή κατηγορία (SPEC-777A §13.1).
  // Ο πελάτης ΔΙΑΒΑΖΕΙ· γράφει ΜΟΝΟ ο διακομιστής (§14.4 κανόνες 1-2, firestore.rules).
  PUBLIC_LANDS:     { mode: 'none', fieldName: '', unscopedCategory: 'public-world', unscopedReason: 'ADR-777 Α1/Α11 — η ΓΗ είναι φυσικό γεγονός, κοινό σε όλους· υπάρχει πριν τη διεκδικήσει οποιοσδήποτε και δεν ανήκει σε κανέναν. Read-only από τον πελάτη.' },
  PUBLIC_BUILDINGS: { mode: 'none', fieldName: '', unscopedCategory: 'public-world', unscopedReason: 'ADR-777 Α11 — «το κτίριο του κόσμου». Κοινή ταυτότητα ώστε προσφορά και ζήτηση να δείχνουν στο ΙΔΙΟ πράγμα (§14.5). Read-only από τον πελάτη.' },

  // --- ADR-777 Α3/Α5: ΔΗΜΟΣΙΕΥΜΕΝΗ ΠΡΟΒΟΛΗ ----------------------------------
  // 🔴 Άλλη κατηγορία από τις δύο παραπάνω, ΚΑΙ Ο ΛΟΓΟΣ ΕΙΝΑΙ Ο ΚΥΚΛΟΣ ΖΩΗΣ: η γη
  // υπάρχει ακόμη κι αν σβήσουν όλοι οι λογαριασμοί· η αγγελία σβήνει μαζί με την
  // απόσυρσή της. Βλ. `UnscopedCategory.published-projection`.
  PUBLIC_LISTINGS:  { mode: 'none', fieldName: '', unscopedCategory: 'published-projection', unscopedReason: 'ADR-777 Α3/Α5/Α20 — προβολή ανάγνωσης της δημοσιευμένης αγγελίας, με κλειστό σχήμα ΧΩΡΙΣ καμία ταυτότητα πελάτη. Το Firestore δεν φιλτράρει πεδία στην ανάγνωση, οπότε η απομόνωση επιτυγχάνεται με ΤΟ ΤΙ ΓΡΑΦΕΤΑΙ, όχι με where(). Read-only από τον πελάτη· γράφει μόνο ο διακομιστής.' },
} as const;

/** Default tenant configuration for collections not in the override map */
const DEFAULT_TENANT_CONFIG: TenantFieldConfig = {
  mode: 'companyId',
  fieldName: 'companyId',
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Returns the tenant field configuration for a given collection.
 *
 * @param key - The CollectionKey to look up
 * @returns TenantFieldConfig with `mode` and `fieldName`
 */
export function getTenantConfig(key: CollectionKey): TenantFieldConfig {
  return TENANT_OVERRIDES[key] ?? DEFAULT_TENANT_CONFIG;
}

/**
 * Resolves the tenant filter value from the auth context based on the isolation mode.
 *
 * @param mode - The tenant isolation mode
 * @param ctx - Object containing uid and companyId
 * @returns The value to filter by, or `null` if no filter should be applied
 */
export function resolveTenantValue(
  mode: TenantIsolationMode,
  ctx: { uid: string; companyId: string | null }
): string | null {
  switch (mode) {
    case 'companyId':
    case 'tenantId':
      return ctx.companyId;
    case 'userId':
      return ctx.uid;
    case 'none':
      return null;
  }
}
