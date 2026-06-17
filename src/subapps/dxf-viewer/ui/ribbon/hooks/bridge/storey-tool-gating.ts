/**
 * storey-tool-gating — pure SSoT mapping a ribbon `commandKey` onto a BIM tool
 * category, then onto a per-storey-kind recommendation (ADR-461 Phase C4).
 *
 * Revit-style ADVISORY gating: counted storeys recommend every tool; a special
 * level (foundation / stair-penthouse / roof) recommends only its own discipline,
 * so the ribbon can de-emphasise (NOT disable — «warn, don't block», mirroring
 * {@link import('../../../../systems/levels/storey-creation-defaults').shouldWarnFoundationOnStorey})
 * the tools that do not belong on that level.
 *
 * Pure + framework-free → unit-testable. The React read of the active storey lives
 * in `useRibbonCommands` (which wires `getCommandRecommendation`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-461-special-levels-foundation-stair-penthouse.md
 * @see systems/levels/storey-creation-defaults.ts — resolveStoreyDefaultEntityTypes (the kind→categories SSoT)
 */

import {
  resolveStoreyDefaultEntityTypes,
  isFoundationDisciplineInContext,
  type BimToolCategory,
} from '../../../../systems/levels/storey-creation-defaults';
import type { ActiveStoreyContext } from '../../../../systems/levels/active-storey-context';

/**
 * Maps a ribbon `commandKey` (Structural / Architecture creation tools, incl. the
 * `*.actions.fromGrid*` one-shots) onto its BIM discipline. Returns `null` for any
 * key that is not a BIM-creation tool (zoom / undo / toggles…) — such commands are
 * never gated. Prefix-based so every `wall*`, `column*`, `beam*`, `foundation*`,
 * `slab*` variant resolves without an exhaustive list.
 */
export function resolveBimToolCategory(commandKey: string): BimToolCategory | null {
  // Openings are tagged before the generic `slab*` prefix (slab-opening ≠ slab).
  if (commandKey === 'slab-opening' || commandKey === 'opening') return 'opening';
  if (commandKey.startsWith('wall')) return 'wall';
  if (commandKey.startsWith('column')) return 'column';
  if (commandKey.startsWith('beam')) return 'beam';
  if (commandKey.startsWith('slab')) return 'slab';
  if (commandKey.startsWith('foundation')) return 'foundation';
  if (commandKey === 'stair') return 'stair';
  if (commandKey === 'railing') return 'railing';
  if (commandKey === 'roof') return 'roof';
  if (commandKey === 'floor-finish') return 'finish';
  return null;
}

/**
 * Whether a creation tool is RECOMMENDED on the active storey. A non-BIM command
 * (category `null`) → always `true` (never gated). `null` storey → always `true`
 * (μηδέν regression).
 *
 * ADR-467 — the FOUNDATION discipline is **graduated**: it is recommended on the
 * foundation level + basements (+ the lowest ground), and de-emphasised on every
 * upper storey / penthouse / roof — even though those are counted storeys that
 * otherwise recommend everything. All other disciplines keep the per-kind
 * recommendation (counted → everything; special levels → their own discipline).
 */
export function isCommandRecommendedForStorey(
  commandKey: string,
  storey: ActiveStoreyContext | null,
): boolean {
  const category = resolveBimToolCategory(commandKey);
  if (category === null) return true;
  // ADR-467 — θεμελίωση: διαβαθμισμένο πλαίσιο (κατώτατες/υπόγειες στάθμες μόνο),
  // ανεξάρτητα από το αν ο όροφος είναι counted (που αλλιώς συστήνει τα πάντα).
  if (category === 'foundation') return isFoundationDisciplineInContext(storey);
  const recommendation = resolveStoreyDefaultEntityTypes(storey?.storeyKind ?? null);
  if (recommendation.mode === 'all') return true;
  return recommendation.categories.has(category);
}
