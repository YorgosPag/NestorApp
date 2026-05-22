/**
 * GRIP CONTEXT MENU RESOLVER — ADR-357 Phase 11 / G10.A + Phase 12 / G10 extras (pure SSoT)
 *
 * Pure mapping from `(Entity, UnifiedGripInfo)` → list of action IDs available
 * in the right-click context menu shown on a hot DXF grip. AutoCAD-style
 * multifunctional grip menu (full variant): universal cycle modes for every
 * grip + the 4 enterprise extras + terminal `Exit` action. No React, no I/O,
 * no commands, no Store reads — the controller fills in the dynamic
 * `checked` / `disabled` flags from the relevant micro-leaf SSoT stores
 * ({@link GripModeStore}, {@link GripCopyModeStore}, {@link GripSessionUndoStore}).
 *
 * Industry rule (AutoCAD / BricsCAD / progeCAD / GstarCAD / nanoCAD):
 *   - Right-click on a hot grip shows ALL 5 cycle modes regardless of entity
 *     type (Stretch / Move / Rotate / Scale / Mirror) plus the 4 grip extras
 *     (Base Point / Copy / Reference / Undo) plus terminal `Exit`.
 *   - Entity-specific actions (Lengthen, Add Vertex, Radius, etc.) belong to
 *     the hover menu (`grip-menu-resolver.ts`), not the right-click menu.
 *
 * Phase 12 extras (ADR-357 §14 G10):
 *   - Base Point  — re-anchor the drag origin via an inline canvas pick
 *   - Copy        — duplicate-on-commit toggle (persistent across drags)
 *   - Reference   — reference-length / reference-angle picker (Scale / Rotate)
 *   - Undo        — session-scoped multi-step undo within the grip-hot session
 *
 * @see grip-context-menu-actions — action binding & dispatch
 * @see grip-mode-cycle           — mode metadata SSoT
 * @see GripContextMenuStore      — UI state container
 */

import type { UnifiedGripInfo } from '../../hooks/grips/unified-grip-types';
import type { Entity } from '../../types/entities';
import type { GripMode } from './grip-mode-cycle';
import { gripModeMeta } from './grip-mode-cycle';

/** Discriminator for Phase 12 extras — drives gating + dispatch in the controller. */
export type GripContextExtraKind =
  | 'basePoint'
  | 'copyToggle'
  | 'reference'
  | 'sessionUndo';

export type GripContextActionId =
  | 'mode:stretch'
  | 'mode:move'
  | 'mode:rotate'
  | 'mode:scale'
  | 'mode:mirror'
  | 'extras:basePoint'
  | 'extras:copyToggle'
  | 'extras:reference'
  | 'extras:sessionUndo'
  | 'vertex-ops:deleteCorner'
  | 'vertex-ops:addCorner'
  | 'exit';

export interface GripContextActionMeta {
  readonly id: GripContextActionId;
  /** Translation key under `tool-hints:gripContextMenu.*`. */
  readonly labelKey: string;
  /** Set when this action toggles a `GripMode` — used by the controller to mark `checked`. */
  readonly mode?: GripMode;
  /** Phase 12 — set on extras so the controller knows which Store to read/write. */
  readonly extraKind?: GripContextExtraKind;
  /** Visual destructive flag — `exit` only. */
  readonly destructive?: boolean;
}

export interface GripContextSectionMeta {
  readonly id: 'modes' | 'extras' | 'vertex-ops' | 'terminal';
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

const EXTRA_ITEMS: ReadonlyArray<GripContextActionMeta> = [
  {
    id: 'extras:basePoint',
    labelKey: 'gripContextMenu.basePoint',
    extraKind: 'basePoint',
  },
  {
    id: 'extras:copyToggle',
    labelKey: 'gripContextMenu.copy',
    extraKind: 'copyToggle',
  },
  {
    id: 'extras:reference',
    labelKey: 'gripContextMenu.reference',
    extraKind: 'reference',
  },
  {
    id: 'extras:sessionUndo',
    labelKey: 'gripContextMenu.undo',
    extraKind: 'sessionUndo',
  },
];

const TERMINAL_ITEMS: ReadonlyArray<GripContextActionMeta> = [
  {
    id: 'exit',
    labelKey: 'gripContextMenu.exit',
    destructive: true,
  },
];

const BASE_SECTIONS: ReadonlyArray<GripContextSectionMeta> = [
  { id: 'modes',    titleKey: 'gripContextMenu.section.modes',    items: MODE_ITEMS },
  { id: 'extras',   titleKey: 'gripContextMenu.section.extras',   items: EXTRA_ITEMS },
  { id: 'terminal', titleKey: 'gripContextMenu.section.terminal', items: TERMINAL_ITEMS },
];

/**
 * ADR-363 Phase 3.8 — vertex-ops section items for slab grips.
 * `deleteCorner` shown on vertex grips, `addCorner` on edge-midpoint grips.
 */
function buildVertexOpsSection(grip: UnifiedGripInfo): GripContextSectionMeta | null {
  const kind = grip.slabGripKind ?? (grip as { slabOpeningGripKind?: string }).slabOpeningGripKind;
  if (!kind) return null;
  if (kind.startsWith('slab-vertex-') || kind.startsWith('slab-opening-vertex-')) {
    return {
      id: 'vertex-ops',
      titleKey: 'gripContextMenu.section.vertexOps',
      items: [{ id: 'vertex-ops:deleteCorner', labelKey: 'gripContextMenu.deleteCorner' }],
    };
  }
  if (kind.startsWith('slab-edge-midpoint-') || kind.startsWith('slab-opening-edge-midpoint-')) {
    return {
      id: 'vertex-ops',
      titleKey: 'gripContextMenu.section.vertexOps',
      items: [{ id: 'vertex-ops:addCorner', labelKey: 'gripContextMenu.addCorner' }],
    };
  }
  return null;
}

/**
 * Resolve the section + action list for a right-click context menu on a hot
 * grip. Pure: the same `(entity, grip)` always yields the same sections.
 *
 * Universal across entity types in Phase 11/12 — parametric grip discriminators
 * (`stairGripKind`, `dimGripKind`, `wallGripKind`) are honored at the commit
 * layer (`commitDxfGripDragModeAware`), so no per-entity gating is needed here.
 *
 * ADR-363 Phase 3.8 — injects a `vertex-ops` section before terminal for slab
 * corner grips ("Delete corner") and slab edge-midpoint grips ("Add corner here").
 */
export function resolveContextMenuSections(
  _entity: Entity,
  grip: UnifiedGripInfo,
): ReadonlyArray<GripContextSectionMeta> {
  const vertexOps = buildVertexOpsSection(grip);
  if (!vertexOps) return BASE_SECTIONS;
  return [
    BASE_SECTIONS[0],
    BASE_SECTIONS[1],
    vertexOps,
    BASE_SECTIONS[2],
  ];
}
