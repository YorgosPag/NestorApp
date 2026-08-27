/**
 * Ο ΚΑΤΑΛΟΓΟΣ ΤΩΝ ΡΟΛΩΝ — **δεδομένα**, καμία απόφαση (ADR-801 §2.11).
 *
 * ⚠️ **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ, ΚΑΙ ΓΙΑΤΙ ΜΕ ΑΥΤΗ ΤΗΝ ΚΑΤΕΥΘΥΝΣΗ.** Η προσθήκη του
 * `ADMINISTRATIVE_ROLES` πήγε το `roles.ts` στις **524/500** γραμμές (N.7.1). Η
 * **πρώτη** τομή έβγαλε τα *παράγωγα* σύνολα σε δικό τους module — και **έσπασε**:
 * τα παράγωγα εξαρτώνται από τον κατάλογο, οπότε το `roles.ts` έπρεπε να τα
 * επανεξάγει, και ο κύκλος έδινε ζωντανά
 * `ReferenceError: Cannot access 'PREDEFINED_ROLES' before initialization` σε **8
 * σουίτες**. *Το έπιασε η εκτέλεση, όχι η ανάγνωση.*
 *
 * 🔑 Η σωστή τομή είναι η **αντίστροφη**: κάτω τα **δεδομένα** (καμία εξάρτηση),
 * πάνω οι **ερωτήσεις**. Το `roles.ts` επανεξάγει τον κατάλογο, ώστε κανένας από
 * τους υπάρχοντες καταναλωτές να **μην αγγιχτεί**.
 *
 * @module lib/auth/role-catalogue
 */

import type { PermissionId } from "./types";

/**
 * Role definition structure.
 */
export interface RoleDefinition {
  /** Display name (Greek) */
  name: string;
  /** Description */
  description: string;
  /** Explicit permission list - NO wildcards */
  permissions: PermissionId[];
  /** Hierarchy level (lower = more access) */
  level: number;
  /** Whether this is a project-scoped role */
  isProjectRole: boolean;
  /** Whether this role bypasses permission checks (super_admin only) */
  isBypass?: boolean;
}

// =============================================================================
// PREDEFINED ROLES
// =============================================================================

/**
 * Predefined roles mapping.
 * Used for bootstrap and role assignment.
 *
 * @example
 * const role = PREDEFINED_ROLES['project_manager'];
 * console.log(role.permissions); // ['projects:projects:view', ...]
 */
export const PREDEFINED_ROLES: Record<string, RoleDefinition> = {
  // ===========================================================================
  // GLOBAL ROLES (Not project-scoped)
  // ===========================================================================

  // 🌐 i18n: All labels converted to i18n keys - 2026-01-18
  super_admin: {
    name: "auth.roles.superAdmin.name",
    description: "auth.roles.superAdmin.description",
    permissions: [], // Empty - handled via isBypass
    level: 0,
    isProjectRole: false,
    isBypass: true, // Bypasses all permission checks
  },

  company_admin: {
    name: "auth.roles.companyAdmin.name",
    description: "auth.roles.companyAdmin.description",
    permissions: [
      "admin_access",
      "users:users:view",
      "users:users:manage",
      "projects:projects:view",
      "projects:projects:create",
      "projects:projects:update",
      "projects:projects:delete",
      "projects:members:view",
      "projects:members:manage",
      "buildings:buildings:view",
      "settings:settings:view",
      "settings:settings:manage",
      "notifications:notifications:view",
      "floorplans:floorplans:process",
      // ADR-344 text engine
      "dxf:layers:unlock",
      "dxf:text:create",
      "dxf:text:edit",
      "dxf:text:delete",
      // ADR-344 Phase 8 — custom dictionary (manage = admin-only)
      "dxf:dictionary:view",
      "dxf:dictionary:manage",
      // Properties (ADR-269 rename from Units)
      "properties:properties:view",
      "properties:properties:create",
      "properties:properties:update",
      "properties:properties:delete",
      // Legacy aliases (parking/storage routes)
      "units:units:view",
      "units:units:create",
      "units:units:update",
      "units:units:delete",
      // Floors
      "projects:floors:delete",
      // CRM — company admin has full contact access (required by floorplan wizard + CRM module)
      "crm:contacts:view",
      "crm:contacts:create",
      "crm:contacts:update",
      "crm:contacts:delete",
      // Communications
      "comm:conversations:list",
      "comm:conversations:view",
      "comm:conversations:update",
      "comm:messages:view",
      "comm:messages:send",
      "comm:messages:delete",
      // BIM 3D Dimensions (ADR-366 Phase 9 / C.3)
      "bim_dimensions_3d:dimensions:create",
      "bim_dimensions_3d:dimensions:read",
      "bim_dimensions_3d:dimensions:update",
      "bim_dimensions_3d:dimensions:delete",
      // BIM Comments (ADR-366 Phase 9 / C.2)
      "bim_comments:comments:create",
      "bim_comments:comments:read",
      "bim_comments:comments:update",
      "bim_comments:comments:delete",
      "bim_comments:comments:assign",
      "bim_comments:comments:archive",
      // BIM Animations (ADR-366 Phase 9 / C.1.a)
      "bim_animations:animations:create",
      "bim_animations:animations:read",
      "bim_animations:animations:update",
      "bim_animations:animations:delete",
      // ADR-655 — χρήση πακέτων περιεχομένου. Το ΑΝ η εταιρεία τα έχει αποκτήσει κρίνεται
      // ξεχωριστά (companies/{id}.assetPackEntitlements) — αυτό εδώ είναι μόνο ο ρόλος.
      "asset_packs:packs:use",
    ],
    level: 1,
    isProjectRole: false,
  },

  internal_user: {
    name: "auth.roles.internalUser.name",
    description: "auth.roles.internalUser.description",
    permissions: [
      "projects:projects:view",
      "projects:floors:view",
      "buildings:buildings:view",
      "properties:properties:view",
      // 🔴 ΤΟ ΠΑΛΙΟ ΟΝΟΜΑ ΤΗΣ ΙΔΙΑΣ ΕΞΟΥΣΙΑΣ — ΜΗΝ ΤΟ ΑΦΑΙΡΕΣΕΙΣ ΜΟΝΟ ΤΟΥ
      //
      // Η μετονομασία `units` → `properties` (ADR-269) **δεν ολοκληρώθηκε**: τα
      // `/api/parking`, `/api/storages`, `/api/spaces/batch-resolve` και το
      // `/api/entity-code/suggest` ζητούν ακόμη το **παλιό** `units:units:view`,
      // ενώ το `/api/properties` ζητά το **νέο**. Ο `internal_user` προστέθηκε
      // **μετά** τη μετονομασία, οπότε πήρε μόνο το νέο όνομα.
      //
      // ⚠️ **Μετρημένο 2026-08-27**: αυτό έκανε τον υπάλληλο να έχει **λιγότερα
      // από τον `viewer`** — τον χαμηλότερο ρόλο του καταλόγου, που **έχει** το
      // `units:units:view`. Κάθε άλλος ρόλος με `properties:properties:view` το
      // ζευγαρώνει· εξαίρεση ήταν **μόνο** `internal_user` και `external_user`
      // *(ο δεύτερος σκόπιμα — έχει συνολικά δύο δικαιώματα)*.
      //
      // 🔴 **Η ΣΥΝΕΠΕΙΑ ΗΤΑΝ ΠΟΡΤΑ ΠΟΥ ΟΔΗΓΟΥΣΕ ΣΕ ΤΟΙΧΟ**: η πλοήγηση έδειχνε
      // «Χώροι», και το άνοιγμά τους έβγαζε `403 Permission denied` — μια
      // επιλογή που **εγγυημένα** αποτύγχανε.
      //
      // ⚠️ **ΜΟΝΟ `view`, επίτηδες**: ο ρόλος δεν έχει `create/update/delete`
      // ούτε για τα `properties`. Είναι ρόλος **ανάγνωσης**· η προσθήκη μένει
      // πιστή στο σχήμα του.
      //
      // 📌 **Το βαθύτερο ερώτημα ΔΕΝ απαντήθηκε εδώ**: είναι το `units:*`
      // *ψευδώνυμο* του `properties:*` (όπως λέει το σχόλιο στο `company_admin`)
      // ή **ξεχωριστή** εξουσία για parking/storage; Τα δύο ζουν σε **άλλες
      // συλλογές**, άρα το σχόλιο μπορεί να είναι λάθος. Η ενοποίηση θέλει δική
      // της συνεδρία (N.8) — δες ADR-823 §13.
      "units:units:view",
      "notifications:notifications:view",
      "asset_packs:packs:use", // ADR-655
    ],
    level: 2,
    isProjectRole: false,
  },

  external_user: {
    name: "auth.roles.externalUser.name",
    description: "auth.roles.externalUser.description",
    permissions: [
      "projects:projects:view",
      "properties:properties:view",
    ],
    level: 3,
    isProjectRole: false,
  },

  // ===========================================================================
  // PROJECT ROLES (Project-scoped)
  // ===========================================================================

  project_manager: {
    name: "auth.roles.projectManager.name",
    description: "auth.roles.projectManager.description",
    permissions: [
      "projects:projects:view",
      "projects:projects:update",
      "projects:members:view",
      "projects:members:manage",
      "projects:floors:view",
      "buildings:buildings:view",
      "properties:properties:view",
      "properties:properties:create",
      "properties:properties:update",
      "properties:properties:delete",
      "units:units:view",
      "units:units:create",
      "units:units:update",
      "units:units:delete",
      "projects:floors:delete",
      "dxf:files:view",
      "dxf:files:upload",
      "dxf:layers:view",
      "dxf:text:create",
      "dxf:text:edit",
      "dxf:text:delete",
      "dxf:dictionary:view",
      "reports:reports:view",
      "reports:reports:create",
      "photos:photos:upload",
      "progress:progress:update",
      "notifications:notifications:view",
      "floorplans:floorplans:process",
      // BIM 3D Dimensions (ADR-366 Phase 9 / C.3)
      "bim_dimensions_3d:dimensions:create",
      "bim_dimensions_3d:dimensions:read",
      "bim_dimensions_3d:dimensions:update",
      "bim_dimensions_3d:dimensions:delete",
      // BIM Comments (ADR-366 Phase 9 / C.2)
      "bim_comments:comments:create",
      "bim_comments:comments:read",
      "bim_comments:comments:update",
      "bim_comments:comments:delete",
      "bim_comments:comments:assign",
      "bim_comments:comments:archive",
      // BIM Animations (ADR-366 Phase 9 / C.1.a)
      "bim_animations:animations:create",
      "bim_animations:animations:read",
      "bim_animations:animations:update",
      "bim_animations:animations:delete",
    ],
    level: 2,
    isProjectRole: true,
  },

  architect: {
    name: "auth.roles.architect.name",
    description: "auth.roles.architect.description",
    permissions: [
      "dxf:files:view",
      "dxf:layers:view",
      "dxf:text:create",
      "dxf:text:edit",
      "dxf:text:delete",
      "dxf:dictionary:view",
      "projects:floors:view",
      "properties:properties:view",
      "units:units:view",
      "notifications:notifications:view",
      // BIM 3D Dimensions (ADR-366 Phase 9 / C.3) — primary user
      "bim_dimensions_3d:dimensions:create",
      "bim_dimensions_3d:dimensions:read",
      "bim_dimensions_3d:dimensions:update",
      "bim_dimensions_3d:dimensions:delete",
      // BIM Comments (ADR-366 Phase 9 / C.2)
      "bim_comments:comments:create",
      "bim_comments:comments:read",
      "bim_comments:comments:update",
      "bim_comments:comments:delete",
      "bim_comments:comments:assign",
      "bim_comments:comments:archive",
      // BIM Animations (ADR-366 Phase 9 / C.1.a)
      "bim_animations:animations:create",
      "bim_animations:animations:read",
      "bim_animations:animations:update",
      "bim_animations:animations:delete",
    ],
    level: 3,
    isProjectRole: true,
  },

  engineer: {
    name: "auth.roles.engineer.name",
    description: "auth.roles.engineer.description",
    permissions: [
      "dxf:files:view",
      "dxf:layers:view",
      "dxf:text:create",
      "dxf:text:edit",
      "dxf:text:delete",
      "dxf:dictionary:view",
      "projects:floors:view",
      "properties:properties:view",
      "units:units:view",
      "specs:specs:view",
      "notifications:notifications:view",
      // BIM 3D Dimensions (ADR-366 Phase 9 / C.3) — primary user
      "bim_dimensions_3d:dimensions:create",
      "bim_dimensions_3d:dimensions:read",
      "bim_dimensions_3d:dimensions:update",
      "bim_dimensions_3d:dimensions:delete",
      // BIM Comments (ADR-366 Phase 9 / C.2)
      "bim_comments:comments:create",
      "bim_comments:comments:read",
      "bim_comments:comments:update",
      "bim_comments:comments:delete",
      "bim_comments:comments:assign",
      "bim_comments:comments:archive",
      // BIM Animations (ADR-366 Phase 9 / C.1.a)
      "bim_animations:animations:create",
      "bim_animations:animations:read",
      "bim_animations:animations:update",
      "bim_animations:animations:delete",
    ],
    level: 3,
    isProjectRole: true,
  },

  site_manager: {
    name: "auth.roles.siteManager.name",
    description: "auth.roles.siteManager.description",
    permissions: [
      "dxf:text:create",
      "dxf:text:edit",
      "dxf:dictionary:view",
      "photos:photos:upload",
      "progress:progress:update",
      "reports:reports:view",
      "reports:reports:create",
      "properties:properties:view",
      "units:units:view",
      "notifications:notifications:view",
    ],
    level: 4,
    isProjectRole: true,
  },

  accountant: {
    name: "auth.roles.accountant.name",
    description: "auth.roles.accountant.description",
    permissions: [
      "finance:invoices:view",
      "finance:invoices:update",
      "reports:reports:view",
      "notifications:notifications:view",
    ],
    level: 4,
    isProjectRole: true,
  },

  sales_agent: {
    name: "auth.roles.salesAgent.name",
    description: "auth.roles.salesAgent.description",
    permissions: [
      "crm:contacts:view",
      "crm:contacts:create",
      "crm:contacts:update",
      "crm:contacts:delete",
      "properties:properties:view",
      "units:units:view",
      "comm:conversations:list",
      "comm:conversations:view",
      "comm:messages:view",
      "comm:messages:send",
      "comm:messages:delete",
      "notifications:notifications:view",
    ],
    level: 4,
    isProjectRole: true,
  },

  data_entry: {
    name: "auth.roles.dataEntry.name",
    description: "auth.roles.dataEntry.description",
    permissions: [
      "projects:projects:view",
      "properties:properties:view",
      "units:units:view",
      "crm:contacts:view",
      "crm:contacts:create",
      "notifications:notifications:view",
    ],
    level: 5,
    isProjectRole: true,
  },

  vendor: {
    name: "auth.roles.vendor.name",
    description: "auth.roles.vendor.description",
    permissions: [
      "orders:orders:view",
      "deliveries:deliveries:view",
      "specs:specs:view",
      "notifications:notifications:view",
    ],
    level: 5,
    isProjectRole: true,
  },

  viewer: {
    name: "auth.roles.viewer.name",
    description: "auth.roles.viewer.description",
    permissions: [
      "projects:projects:view",
      "projects:floors:view",
      "properties:properties:view",
      "units:units:view",
      "dxf:files:view",
      "dxf:layers:view",
      "reports:reports:view",
      // BIM Comments (ADR-366 Phase 9 / C.2) — read only
      "bim_comments:comments:read",
      // BIM Animations (ADR-366 Phase 9 / C.1.a) — read only
      "bim_animations:animations:read",
    ],
    level: 6,
    isProjectRole: true,
  },
};
