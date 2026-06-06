/**
 * ADR-345 Fase 5.6 — SSoT for ribbon tool-button active state.
 *
 * Single predicate shared by RibbonLargeButton, RibbonSmallButton and
 * RibbonSplitButton so the "this button maps to the active tool" rule
 * lives in exactly one place. Reasons a command is NOT active:
 *   - it's a placeholder (comingSoon) — no real tool behind it
 *   - it dispatches an action (zoom-extents, toggle-fullscreen, …) —
 *     transient, not a persistent tool mode
 *   - no tool currently selected (activeTool = null)
 *   - commandKey does not match the active tool
 */

import type { ToolType } from '../../toolbar/types';
import type { RibbonCommand } from '../types/ribbon-types';

export function isCommandActive(
  command: Pick<RibbonCommand, 'commandKey' | 'comingSoon' | 'action'>,
  activeTool: ToolType | null,
): boolean {
  if (command.comingSoon) return false;
  if (command.action) return false;
  if (activeTool === null) return false;
  return command.commandKey === activeTool;
}

/**
 * ADR-419 §ribbon-hierarchy — Recursively collect LEAF commands from a
 * variant tree. A leaf is a command WITHOUT `subVariants` (submenu headers
 * are skipped — they never fire a tool). SSoT used by both last-used
 * resolution (RibbonSplitButton) and active-state highlighting.
 */
export function flattenLeafVariants(
  variants: readonly RibbonCommand[],
): RibbonCommand[] {
  const leaves: RibbonCommand[] = [];
  for (const v of variants) {
    if (v.subVariants && v.subVariants.length > 0) {
      leaves.push(...flattenLeafVariants(v.subVariants));
    } else {
      leaves.push(v);
    }
  }
  return leaves;
}

/**
 * Split-button variant: active when ANY leaf variant under the split maps to
 * the current tool — lets the user see "I'm in Line" even when the
 * visible default of the split is a sub-variant like line-parallel.
 * Recurses into `subVariants` (ADR-419 cascading submenus).
 */
export function isAnyVariantActive(
  variants: readonly RibbonCommand[],
  activeTool: ToolType | null,
): boolean {
  if (activeTool === null) return false;
  return flattenLeafVariants(variants).some((v) => isCommandActive(v, activeTool));
}
