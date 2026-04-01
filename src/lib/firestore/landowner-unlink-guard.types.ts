/**
 * 🛡️ Landowner Unlink Guard Types
 *
 * Shared types for the landowner unlink guard system.
 * Separated from the server-only module so client components can import them.
 *
 * @module lib/firestore/landowner-unlink-guard.types
 */

// ============================================================================
// TYPES
// ============================================================================

export interface UnlinkDependency {
  readonly label: string;
  readonly collection: string;
  readonly count: number;
}

export interface LandownerUnlinkResult {
  /** true if no blocking dependencies exist */
  readonly allowed: boolean;
  /** UI variant: confirm (safe), warning (non-blocking deps), blocked (blocking deps) */
  readonly variant: 'confirm' | 'warning' | 'blocked';
  /** Dependencies that PREVENT removal (properties, parking, storage with this owner) */
  readonly blockingDeps: UnlinkDependency[];
  /** Dependencies that WARN but allow removal (ownership table references) */
  readonly warningDeps: UnlinkDependency[];
  /** Human-readable Greek message */
  readonly message: string;
}
