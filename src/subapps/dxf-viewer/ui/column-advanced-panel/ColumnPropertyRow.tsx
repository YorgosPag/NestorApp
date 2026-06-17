'use client';

/**
 * ADR-363 Phase 4 / Properties-palette split — column Properties row.
 *
 * ADR-471 (boy-scout, N.0.2): η υλοποίηση ενοποιήθηκε στο member-agnostic
 * `ui/bim-properties/BimPropertyRow` (το μοιράζονται κολόνα + δοκάρι — μηδέν
 * διπλότυπο). Αυτό το module μένει ως thin re-export ώστε οι column callers
 * (`ColumnAdvancedPanel`) + το public API να μη σπάσουν.
 */

export { BimPropertyRow as ColumnPropertyRow } from '../bim-properties/BimPropertyRow';
export type { BimPropertyRowProps as ColumnPropertyRowProps } from '../bim-properties/BimPropertyRow';
