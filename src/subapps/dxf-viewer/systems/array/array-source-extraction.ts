/**
 * ADR-353 → ADR-575: source extraction/restoration was PROMOTED to the neutral
 * SSoT `core/commands/entity-commands/entity-source-extraction.ts` so ARRAY and
 * GROUP (and any future container command) share ONE implementation (N.12 SSoT).
 *
 * This module stays as a thin re-export for the existing array-domain importers
 * (CreateArrayCommand, array-edit-source-mode) — zero behavioural change.
 */

export {
  extractSourcesFromScene,
  restoreSourcesToScene,
} from '../../core/commands/entity-commands/entity-source-extraction';
