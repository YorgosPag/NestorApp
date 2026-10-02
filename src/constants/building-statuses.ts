/**
 * =============================================================================
 * SSoT: BuildingStatus Canonical Definitions
 * =============================================================================
 *
 * **Single Source of Truth** για το lifecycle status ενός Building.
 * Pre-centralization, το ίδιο concept οριζόταν δύο φορές:
 *   - inline union στο `src/types/building/contracts.ts` (5 values, incl. `deleted`)
 *   - duplicated array στο `src/config/report-builder/domain-definitions.ts`
 *     (4 values — `deleted` εξαιρείται από report-builder filter dropdowns)
 *
 * **Layering**: Leaf module — **καμία** εξάρτηση από components, hooks, services.
 * Ασφαλές για import παντού (server, client, tests).
 *
 * @module constants/building-statuses
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 9)
 */

// =============================================================================
// 1. CANONICAL ARRAY — Full lifecycle incl. soft-delete
// =============================================================================

/**
 * All canonical BuildingStatus values.
 *
 * - `planning`     — Σχεδιασμός (προ-κατασκευαστική φάση)
 * - `construction` — Υπό κατασκευή
 * - `completed`    — Ολοκληρωμένο (αποπεράτωση)
 * - `active`       — Ενεργό (σε χρήση/λειτουργία)
 * - `deleted`      — Soft-deleted (στον κάδο — ADR-028 soft-delete pattern)
 */
export const BUILDING_STATUSES = [
  'planning',
  'construction',
  'completed',
  'active',
  'deleted',
] as const;

/** Canonical TypeScript union — derived automatically from `BUILDING_STATUSES`. */
export type BuildingStatus = (typeof BUILDING_STATUSES)[number];

// =============================================================================
// 2. RUNTIME TYPE GUARD + LEGACY ALIASES (ADR-898 §18.2)
// =============================================================================

export function isBuildingStatus(value: unknown): value is BuildingStatus {
  return BUILDING_STATUSES.some((status) => status === value);
}

/**
 * Τιμές που **γράφτηκαν** σε κτίρια από άλλο λεξιλόγιο και σημαίνουν κανονική κατάσταση. Το `in_progress` είναι
 * κατάσταση **έργου** (`ProjectStatus`)· σε κτίριο σημαίνει «υπό κατασκευή». Μετρημένο 2026-10-02: 4 κτίρια παλιού
 * seed (χωρίς `createdAt`/`_v`)· κανένας γραφέας του κώδικα δεν το παράγει.
 */
const LEGACY_BUILDING_STATUS_ALIASES: ReadonlyMap<string, BuildingStatus> = new Map([['in_progress', 'construction']]);

/**
 * Η αποθηκευμένη τιμή → κανονική κατάσταση, ή `null` όταν δεν αναγνωρίζεται (ποτέ μαντεψιά — όπως το `UNSPECIFIED`
 * του Protobuf για άγνωστη τιμή enum). Ο ΕΝΑΣ τόπος όπου ζουν τα ψευδώνυμα.
 */
export function parseBuildingStatus(raw: unknown): BuildingStatus | null {
  if (isBuildingStatus(raw)) return raw;
  return typeof raw === 'string' ? LEGACY_BUILDING_STATUS_ALIASES.get(raw) ?? null : null;
}

// =============================================================================
// 3. DERIVED SUBSETS
// =============================================================================

/**
 * Active (non-soft-deleted) building statuses — χρησιμοποιούνται σε list/filter
 * dropdowns (report builder, building list pages).
 */
export const ACTIVE_BUILDING_STATUSES = [
  'planning',
  'construction',
  'completed',
  'active',
] as const satisfies readonly BuildingStatus[];
/**
 * Statuses που σημαίνουν pre-completion κατάσταση (αναφέρεται σε κτίρια
 * πριν την αποπεράτωση). Χρήσιμο για construction progress dashboards.
 */
export const IN_CONSTRUCTION_BUILDING_STATUSES = [
  'planning',
  'construction',
] as const satisfies readonly BuildingStatus[];
