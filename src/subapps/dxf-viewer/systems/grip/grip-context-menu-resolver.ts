/**
 * GRIP CONTEXT MENU RESOLVER — ADR-357 Phase 11 / G10.A (pure SSoT)
 *
 * Pure mapping from `(Entity, UnifiedGripInfo)` → list of action IDs available
 * in the right-click context menu shown on a hot DXF grip. AutoCAD-style
 * multifunctional grip menu (full variant): universal cycle modes for every
 * grip + terminal `Exit` action. No React, no I/O, no commands.
 *
 * Industry rule (AutoCAD / BricsCAD / progeCAD / GstarCAD / nanoCAD):
 *   - Right-click on a hot grip shows ALL 5 cycle modes regardless of entity
 *     type (Stretch / Move / Rotate / Scale / Mirror) plus terminal actions.
 *   - The action set is grip-agnostic at this layer — entity-specific actions
 *     (Lengthen, Add Vertex, Radius, etc.) belong to the hover menu
 *     (`grip-menu-resolver.ts`), not the right-click context menu.
 *
 * Deferred to Phase 12 (not surfaced now to avoid silent stubs):
 *   - Base Point  — re-anchor the drag origin
 *   - Copy        — duplicate-on-commit mode toggle
 *   - Reference   — reference-length / reference-angle picker (rotate/scale)
 *   - Undo        — undo last grip operation in a multi-step session
 *
 * @see grip-context-menu-actions — action binding & dispatch
 * @see grip-mode-cycle           — mode metadata SSoT
 * @see GripContextMenuStore      — UI state container
 */

import type { UnifiedGripInfo } from '../../hooks/grips/unified-grip-types';
import type { Entity } from '../../types/entities';
import type { GripMode } from './grip-mode-cycle';
import { gripModeMeta } from './grip-mode-cycle';

export type GripContextActionId =
  | 'mode:stretch'
  | 'mode:move'
  | 'mode:rotate'
  | 'mode:scale'
  | 'mode:mirror'
  | 'exit';

export interface GripContextActionMeta {
  readonly id: GripContextActionId;
  /** Translation key under `tool-hints:gripContextMenu.*`. */
  readonly labelKey: string;
  /** Set when this action toggles a `GripMode` — used by the controller to mark `checked`. */
  readonly mode?: GripMode;
  /** Visual destructive flag — `exit` only. */
  readonly destructive?: boolean;
}

export interface GripContextSectionMeta {
  readonly id: 'modes' | 'terminal';
  readonly titleKey?: string;
  readonly items: ReadonlyArray<GripContextActionMeta>;
}

const MODE_ITEMS: ReadonlyArray<GripContextActionMeta> = (
  ['stretch', 'move', 'rotate', 'scale', 'mirror'] as const
).map((mode) => ({
  id: `mode:${mode}` as GripContextActionId,
  labelKey: gripModeMeta(mode).labelKey,
  mode,
}));

const TERMINAL_ITEMS: ReadonlyArray<GripContextActionMeta> = [
  {
    id: 'exit',
    labelKey: 'gripContextMenu.exit',
    destructive: true,
  },
];

const SECTIONS: ReadonlyArray<GripContextSectionMeta> = [
  { id: 'modes',    titleKey: 'gripContextMenu.section.modes',    items: MODE_ITEMS },
  { id: 'terminal', titleKey: 'gripContextMenu.section.terminal', items: TERMINAL_ITEMS },
];

/**
 * Resolve the section + action list for a right-click context menu on a hot
 * grip. Pure: the same `(entity, grip)` always yields the same sections.
 *
 * Universal across entity types in Phase 11 — parametric grip discriminators
 * (`stairGripKind`, `dimGripKind`, `wallGripKind`) are honored at the commit
 * layer (`commitDxfGripDragModeAware`), so no per-entity gating is needed here.
 *
 * @param _entity reserved — accepted for future per-entity gating (e.g. hide
 *                Rotate on POINT entities); currently returns the full menu.
 * @param _grip   reserved — accepted for future grip-type gating; same.
 */
export function resolveContextMenuSections(
  _entity: Entity,
  _grip: UnifiedGripInfo,
): ReadonlyArray<GripContextSectionMeta> {
  return SECTIONS;
}
