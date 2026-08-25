/**
 * @fileoverview Predefined Roles - RFC v6 Implementation
 * @version 1.0.0
 * @author Nestor Construct Platform
 * @since 2026-01-14
 *
 * Predefined role definitions with explicit permission arrays.
 * NO WILDCARDS - all permissions are explicitly listed for security.
 *
 * @see docs/rfc/authorization-rbac.md
 */

import type { GlobalRole, PermissionId } from "./types";
import { GLOBAL_ROLES } from "./types";
import { PREDEFINED_ROLES } from "./role-catalogue";
import type { RoleDefinition } from "./role-catalogue";

// =============================================================================
// ROLE DEFINITION INTERFACE
// =============================================================================

/**
 * ⚠️ **ΕΠΑΝΕΞΑΓΩΓΗ, ΟΧΙ ΟΡΙΣΜΟΣ.** Ο **κατάλογος** μετακόμισε σε `./role-catalogue`
 * (δεδομένα· εδώ ζουν οι **ερωτήσεις** πάνω τους — N.7.1: το αρχείο είχε φτάσει
 * 524/500). Επανεξάγεται ώστε κανένας καταναλωτής να μην αγγιχτεί.
 *
 * 🔴 **ΔΥΟ ΓΡΑΜΜΕΣ, ΟΧΙ ΜΙΑ — ΚΑΙ Ο ΛΟΓΟΣ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟΣ** (ADR-806 §7 #1). Ένα
 * `export … from` **ΔΕΝ φέρνει το όνομα στην τοπική εμβέλεια**: επανεξάγει, δεν
 * εισάγει. Ο `PREDEFINED_ROLES` (τιμή) ήταν **ήδη σωστός** — η γρ. 15 τον εισάγει
 * ξεχωριστά, γιατί χωρίς αυτήν το σώμα των συναρτήσεων **δεν έτρεχε** και το έβλεπε
 * κανείς αμέσως. Ο `RoleDefinition` (τύπος) **δεν** ήταν: ένας τύπος που λείπει δεν
 * σπάει τίποτα σε χρόνο εκτέλεσης, και ο N.17 απαγορεύει στον πράκτορα να τρέξει
 * `tsc` ⇒ το ίδιο αρχείο έκανε **σωστά** τη μία μισή πράξη και **λάθος** την άλλη,
 * επί μήνες, σε αρχείο **ασφαλείας**. ⚠️ **ΜΗΝ** το «λύσεις» σβήνοντας το `export`
 * (ο τύπος είναι μέρος του δημόσιου συμβολαίου) ούτε με `any` (N.2).
 */
export type { RoleDefinition };
export { PREDEFINED_ROLES } from "./role-catalogue";


// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get role definition by ID.
 *
 * @param roleId - Role identifier
 * @returns Role definition or undefined
 */
export function getRole(roleId: string): RoleDefinition | undefined {
  return PREDEFINED_ROLES[roleId];
}

/**
 * Get permissions for a role.
 *
 * @param roleId - Role identifier
 * @returns Permission array or empty array
 */
export function getRolePermissions(roleId: string): PermissionId[] {
  const role = PREDEFINED_ROLES[roleId];
  return role?.permissions ?? [];
}

/**
 * Check if a role is a bypass role (super_admin).
 *
 * @param roleId - Role identifier
 * @returns True if role bypasses permission checks
 */
export function isRoleBypass(roleId: string): boolean {
  const role = PREDEFINED_ROLES[roleId];
  return role?.isBypass === true;
}

/**
 * Οι **καθολικοί** ρόλοι που παρακάμπτουν κάθε έλεγχο — **ΤΑΒΑΝΙ**, όχι παραχώρηση.
 *
 * 🔑 **Γιατί υπάρχει** (ADR-801 §2.10): δηλώνεται στο σύνορο ως
 * `withAuth(h, { requiredGlobalRoles: BYPASS_ROLES })`, ώστε η απόφαση *«μόνο
 * υπερδιαχειριστής»* να είναι **δεδομένο στη δήλωση** αντί για `if` μέσα στον
 * handler — το *«Hardcoded Rules» antipattern* που ονομάζει το OWASP.
 *
 * ⚠️ **ΠΑΡΑΓΟΜΕΝΗ, ΠΟΤΕ ΓΡΑΜΜΕΝΗ ΜΕ ΤΟ ΧΕΡΙ.** Το ADR-703 το λέει ρητά: ένα ωμό
 * `['super_admin']` *«silently refuses any **second** bypass role its own
 * privileges — the code reads correct, the behaviour is wrong, and nothing
 * fails»*. Εδώ ο κατάλογος βγαίνει από το **ίδιο** `PREDEFINED_ROLES` που
 * ρωτά ο `isRoleBypass`, οπότε ένας δεύτερος bypass ρόλος τιμάται **παντού
 * ταυτόχρονα**.
 *
 * ⚠️ **Είναι ΤΑΒΑΝΙ**: κατά το πρότυπο SCP/permissions-boundary του AWS,
 * *«ceilings only subtract»* — τα effective permissions είναι η **τομή** των
 * στρωμάτων. Δεν παραχωρεί τίποτα σε κανέναν, και **δεν μπορεί να αγοραστεί**
 * από το claim `permissions` (ADR-801 §2.8), γιατί το `withAuth` κρίνει τον
 * ρόλο **πριν** τις ικανότητες.
 */
export const BYPASS_ROLES: readonly GlobalRole[] = Object.freeze(
  (GLOBAL_ROLES as readonly GlobalRole[]).filter((role) => isRoleBypass(role)),
);

/**
 * Οι **καθολικοί** ρόλοι που κατέχουν **διοικητική** πρόσβαση — **ΤΑΒΑΝΙ**.
 *
 * 🔑 **Γιατί υπάρχει** (ADR-801 §2.11): το σύνολο *«υπερδιαχειριστής **ή**
 * διαχειριστής εταιρείας»* ήταν γραμμένο **επτά φορές** στο δέντρο — τέσσερις ως
 * inline `globalRole === 'super_admin' || globalRole === 'company_admin'` μέσα σε
 * handlers, και τρεις ως ιδιωτική σταθερά με **τρία διαφορετικά ονόματα**
 * (`ADMIN_ROLES` · `ADMIN_GLOBAL_ROLES`). Επτά αντίγραφα ενός συνόλου είναι επτά
 * ευκαιρίες να αποκλίνει.
 *
 * ⚠️ **ΠΑΡΑΓΩΓΗ ΑΠΟ ΤΗΝ ΙΚΑΝΟΤΗΤΑ, ΟΧΙ ΑΠΟ ΟΝΟΜΑΤΑ.** Ο ορισμός του «διοικητικός»
 * **είναι** η ικανότητα `admin_access`: την κατέχει ρητά ο `company_admin`, και ο
 * `super_admin` την έχει μέσω `isBypass`. Μετρημένο: **ακριβώς δύο** ρόλοι από
 * **13**, δηλαδή το παραγόμενο σύνολο είναι **ταυτόσημο** με ό,τι έγραφαν τα επτά
 * αντίγραφα — η ανύψωση είναι **αποδεδειγμένα ουδέτερη**.
 *
 * ⚠️ **ΤΑΒΑΝΙ ΚΑΙ ΟΧΙ ΙΚΑΝΟΤΗΤΑ, ΚΑΙ Η ΔΙΑΦΟΡΑ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΗ**: δήλωση
 * `permissions: 'admin_access'` θα **έδινε** πρόσβαση σε όποιον κουβαλά το
 * `admin_access` ως **extra** στο claim του — και τέτοιος χρήστης **υπάρχει
 * ζωντανά** (ADR-801 §2.6: `external_user` **+** `permissions: ['admin_access']`,
 * εκκρεμής η Φάση 2δ). Το `requiredGlobalRoles` κρίνεται στο **Βήμα 4** του
 * `withAuth`, **πριν** τις ικανότητες, άρα **δεν αγοράζεται από το claim**.
 */
export const ADMINISTRATIVE_ROLES: readonly GlobalRole[] = Object.freeze(
  (GLOBAL_ROLES as readonly GlobalRole[]).filter(
    (role) => isRoleBypass(role) || getRolePermissions(role).includes('admin_access'),
  ),
);

/**
 * Get all project roles.
 *
 * @returns Array of project role IDs
 */
export function getProjectRoles(): string[] {
  return Object.entries(PREDEFINED_ROLES)
    .filter(([_, def]) => def.isProjectRole)
    .map(([id]) => id);
}

/**
 * Get all global roles.
 *
 * @returns Array of global role IDs
 */
export function getGlobalRoles(): string[] {
  return Object.entries(PREDEFINED_ROLES)
    .filter(([_, def]) => !def.isProjectRole)
    .map(([id]) => id);
}

/**
 * Compare role levels (for hierarchy checks).
 * Returns negative if role1 has higher access than role2.
 *
 * @param roleId1 - First role ID
 * @param roleId2 - Second role ID
 * @returns Comparison result
 */
export function compareRoleLevels(roleId1: string, roleId2: string): number {
  const level1 = PREDEFINED_ROLES[roleId1]?.level ?? Infinity;
  const level2 = PREDEFINED_ROLES[roleId2]?.level ?? Infinity;
  return level1 - level2;
}
