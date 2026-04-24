/**
 * =============================================================================
 * SSoT: ProjectStatus Canonical Definitions
 * =============================================================================
 *
 * **Single Source of Truth** για το lifecycle status ενός Project.
 * Pre-centralization, το ίδιο concept οριζόταν δύο φορές:
 *   - inline union στο `src/types/project.ts` (6 values, incl. `deleted`)
 *   - duplicated array στο `src/config/report-builder/domain-definitions.ts`
 *     (5 values — `deleted` εξαιρείται από report-builder filter dropdowns)
 *
 * **Layering**: Leaf module — **καμία** εξάρτηση από components, hooks, services.
 * Ασφαλές για import παντού (server, client, tests).
 *
 * @module constants/project-statuses
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 9)
 */

// =============================================================================
// 1. CANONICAL ARRAY — Full lifecycle incl. soft-delete
// =============================================================================

/**
 * All canonical ProjectStatus values.
 *
 * - `planning`    — Σχεδιασμός
 * - `in_progress` — Σε εξέλιξη
 * - `completed`   — Ολοκληρωμένο
 * - `on_hold`     — Σε αναμονή
 * - `cancelled`   — Ακυρωμένο
 * - `deleted`     — Soft-deleted (στον κάδο — ADR-028 soft-delete pattern)
 */
export const PROJECT_STATUSES = [
  'planning',
  'in_progress',
  'completed',
  'on_hold',
  'cancelled',
  'deleted',
] as const;

/** Canonical TypeScript union — derived automatically from `PROJECT_STATUSES`. */
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

// =============================================================================
// 2. RUNTIME TYPE GUARD
// =============================================================================

/** Returns `true` if `value` is one of the 6 canonical project statuses. */
export function isProjectStatus(value: unknown): value is ProjectStatus {
  return (
    typeof value === 'string' &&
    (PROJECT_STATUSES as readonly string[]).includes(value)
  );
}

// =============================================================================
// 3. DERIVED SUBSETS
// =============================================================================

/**
 * Active (non-soft-deleted) project statuses — χρησιμοποιούνται σε list/filter
 * dropdowns (report builder, project list pages). Το `deleted` εξαιρείται
 * γιατί τα soft-deleted projects εμφανίζονται ξεχωριστά στον κάδο.
 */
export const ACTIVE_PROJECT_STATUSES = [
  'planning',
  'in_progress',
  'completed',
  'on_hold',
  'cancelled',
] as const satisfies readonly ProjectStatus[];
/**
 * Statuses που σημαίνουν ενεργό (σε εξέλιξη) project — δεν έχει
 * ολοκληρωθεί/ακυρωθεί/διαγραφεί.
 */
export const IN_PROGRESS_PROJECT_STATUSES = [
  'planning',
  'in_progress',
  'on_hold',
] as const satisfies readonly ProjectStatus[];
