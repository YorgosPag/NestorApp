/**
 * =============================================================================
 * SSoT: PriorityLevel Canonical Definitions
 * =============================================================================
 *
 * **Single Source of Truth** για την 4-τιμη κλίμακα προτεραιότητας που
 * χρησιμοποιείται σε work items παντού στην εφαρμογή (Buildings, Projects,
 * future: Tasks, Tickets, Incidents, etc.).
 *
 * Pre-centralization, το ίδιο 4-value concept οριζόταν δύο φορές με
 * διαφορετικά ονόματα:
 *   - `BuildingPriority` inline στο `src/types/building/contracts.ts`
 *   - `PROJECT_PRIORITIES` array inline στο `domain-definitions.ts`
 *
 * **Layering**: Leaf module — **καμία** εξάρτηση από components, hooks, services.
 * Ασφαλές για import παντού (server, client, tests).
 *
 * @module constants/priority-levels
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 9)
 */

// =============================================================================
// 1. CANONICAL ARRAY — Ordered low → critical (index = urgency rank)
// =============================================================================

/**
 * All canonical PriorityLevel values, ordered ascending urgency.
 *
 * - `low`      — Χαμηλή
 * - `medium`   — Μέτρια
 * - `high`     — Υψηλή
 * - `critical` — Κρίσιμη
 */
export const PRIORITY_LEVELS = ['low', 'medium', 'high', 'critical'] as const;

/** Canonical TypeScript union — derived automatically from `PRIORITY_LEVELS`. */
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

// =============================================================================
// 2. RUNTIME TYPE GUARD
// =============================================================================

/** Returns `true` if `value` is one of the 4 canonical priority levels. */
export function isPriorityLevel(value: unknown): value is PriorityLevel {
  return (
    typeof value === 'string' &&
    (PRIORITY_LEVELS as readonly string[]).includes(value)
  );
}

// =============================================================================
// 3. RANK HELPER — Numeric comparison για sorting/escalation
// =============================================================================

/**
 * Returns numeric rank (0 = low, 3 = critical). Χρησιμοποιείται για sort
 * comparisons ή escalation thresholds (e.g. `rank >= 2` για high+critical).
 */
export function getPriorityRank(priority: PriorityLevel): number {
  return (PRIORITY_LEVELS as readonly string[]).indexOf(priority);
}
