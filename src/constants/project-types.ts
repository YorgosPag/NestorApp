/**
 * =============================================================================
 * SSoT: ProjectType Canonical Definitions
 * =============================================================================
 *
 * **Single Source of Truth** για τον τύπο ενός Project (construction industry).
 * Pre-centralization, το ίδιο concept οριζόταν δύο φορές:
 *   - inline union στο `src/types/project.ts`
 *   - duplicated array στο `src/config/report-builder/domain-definitions.ts`
 *
 * **Σημείωση αρχιτεκτονικής**: Επικαλύπτεται εν μέρει με το `BuildingType`
 * (4 κοινές τιμές: residential/commercial/industrial/mixed) αλλά δεν συγχωνεύεται.
 * Διαφορετικά domains: το `ProjectType` περιγράφει ολόκληρο project (π.χ.
 * `infrastructure`, `renovation`), ενώ το `BuildingType` αφορά μεμονωμένο
 * building unit (`office`, `warehouse`).
 *
 * **Layering**: Leaf module — **καμία** εξάρτηση από components, hooks, services.
 * Ασφαλές για import παντού (server, client, tests).
 *
 * @module constants/project-types
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 9)
 */

// =============================================================================
// 1. CANONICAL ARRAY
// =============================================================================

/**
 * All canonical ProjectType values.
 *
 * - `residential`    — Κατοικίες
 * - `commercial`     — Εμπορικό
 * - `industrial`     — Βιομηχανικό
 * - `mixed`          — Μικτή χρήση
 * - `infrastructure` — Υποδομές
 * - `renovation`     — Ανακαίνιση
 */
export const PROJECT_TYPES = [
  'residential',
  'commercial',
  'industrial',
  'mixed',
  'infrastructure',
  'renovation',
] as const;

/** Canonical TypeScript union — derived automatically from `PROJECT_TYPES`. */
export type ProjectType = (typeof PROJECT_TYPES)[number];

// =============================================================================
// 2. RUNTIME TYPE GUARD
// =============================================================================

