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
import { gripKindOf } from '../../hooks/grip-kinds';
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
  // ADR-510 Φ3c — multifunctional polyline grip ops (live in this right-click menu,
  // alongside slab/roof vertex-ops; the hover menu does NOT repeat them).
  | 'polyline-ops:addVertex'
  | 'polyline-ops:removeVertex'
  | 'polyline-ops:convertToArc'
  | 'polyline-ops:convertToLine'
  // ADR-507 (Giorgio 2026-07-07) — hatch boundary vertex ops (add on edge-midpoint,
  // remove on vertex). Multi-ring/island-safe via the `hatchGripKind` discriminator.
  | 'hatch-ops:addVertex'
  | 'hatch-ops:removeVertex'
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
  readonly id: 'modes' | 'extras' | 'vertex-ops' | 'polyline-ops' | 'hatch-ops' | 'terminal';
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
 * ADR-363 Phase 3.8 + ADR-417 Φ1-part-2 #2 — vertex-ops section items for
 * polygon-outline grips (slab / slab-opening / roof). `deleteCorner` shown on
 * vertex grips, `addCorner` on edge-midpoint grips.
 */
function buildVertexOpsSection(grip: UnifiedGripInfo): GripContextSectionMeta | null {
  const kind =
    gripKindOf(grip, 'slab') ??
    gripKindOf(grip, 'slab-opening') ??
    gripKindOf(grip, 'roof');
  if (!kind) return null;
  if (
    kind.startsWith('slab-vertex-') ||
    kind.startsWith('slab-opening-vertex-') ||
    kind.startsWith('roof-vertex-')
  ) {
    return {
      id: 'vertex-ops',
      titleKey: 'gripContextMenu.section.vertexOps',
      items: [{ id: 'vertex-ops:deleteCorner', labelKey: 'gripContextMenu.deleteCorner' }],
    };
  }
  if (
    kind.startsWith('slab-edge-midpoint-') ||
    kind.startsWith('slab-opening-edge-midpoint-') ||
    kind.startsWith('roof-edge-midpoint-')
  ) {
    return {
      id: 'vertex-ops',
      titleKey: 'gripContextMenu.section.vertexOps',
      items: [{ id: 'vertex-ops:addCorner', labelKey: 'gripContextMenu.addCorner' }],
    };
  }
  return null;
}

/**
 * ADR-510 Φ3c — multifunctional polyline grip ops, keyed by `polylineGripKind`:
 *   - vertex            → Add Vertex / Remove Vertex / Convert to Arc
 *   - segment-midpoint  → Add Vertex / Convert to Arc
 *   - arc-midpoint      → Convert to Line
 * Lives in the right-click menu (mirror of `buildVertexOpsSection` slab/roof) so a
 * single menu carries every grip action; the hover menu skips polyline entirely.
 */
function buildPolylineOpsSection(grip: UnifiedGripInfo): GripContextSectionMeta | null {
  const kind = gripKindOf(grip, 'polyline');
  if (!kind) return null;
  const titleKey = 'gripContextMenu.section.polylineOps';
  if (kind.startsWith('polyline-vertex-')) {
    return {
      id: 'polyline-ops',
      titleKey,
      items: [
        { id: 'polyline-ops:addVertex', labelKey: 'gripContextMenu.addVertex' },
        { id: 'polyline-ops:removeVertex', labelKey: 'gripContextMenu.removeVertex' },
        { id: 'polyline-ops:convertToArc', labelKey: 'gripContextMenu.convertToArc' },
      ],
    };
  }
  if (kind.startsWith('polyline-segment-midpoint-')) {
    return {
      id: 'polyline-ops',
      titleKey,
      items: [
        { id: 'polyline-ops:addVertex', labelKey: 'gripContextMenu.addVertex' },
        { id: 'polyline-ops:convertToArc', labelKey: 'gripContextMenu.convertToArc' },
      ],
    };
  }
  if (kind.startsWith('polyline-arc-midpoint-')) {
    return {
      id: 'polyline-ops',
      titleKey,
      items: [
        { id: 'polyline-ops:convertToLine', labelKey: 'gripContextMenu.convertToLine' },
      ],
    };
  }
  return null;
}

/**
 * ADR-507 (Giorgio 2026-07-07) — hatch boundary grip ops, keyed by `hatchGripKind`:
 *   - `hatch-vertex-*`        → Remove Vertex (drop this corner)
 *   - `hatch-edge-midpoint-*` → Add Vertex (insert a corner at this edge midpoint)
 * Lives in the right-click menu (mirror of slab/roof `buildVertexOpsSection` and the
 * polyline `buildPolylineOpsSection`) so one menu carries every grip action. Add lives on
 * edge-midpoint grips, Remove on vertex grips — big-player parity (AutoCAD/Revit).
 */
function buildHatchOpsSection(grip: UnifiedGripInfo): GripContextSectionMeta | null {
  const kind = gripKindOf(grip, 'hatch');
  if (!kind) return null;
  const titleKey = 'gripContextMenu.section.hatchOps';
  if (kind.startsWith('hatch-vertex-')) {
    return {
      id: 'hatch-ops',
      titleKey,
      items: [{ id: 'hatch-ops:removeVertex', labelKey: 'gripContextMenu.removeVertex' }],
    };
  }
  if (kind.startsWith('hatch-edge-midpoint-')) {
    return {
      id: 'hatch-ops',
      titleKey,
      items: [{ id: 'hatch-ops:addVertex', labelKey: 'gripContextMenu.addVertex' }],
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
  // slab/roof vertex-ops OR polyline-ops OR hatch-ops (mutually exclusive per entity type).
  const opsSection =
    buildVertexOpsSection(grip) ?? buildPolylineOpsSection(grip) ?? buildHatchOpsSection(grip);
  if (!opsSection) return BASE_SECTIONS;
  return [
    BASE_SECTIONS[0],
    BASE_SECTIONS[1],
    opsSection,
    BASE_SECTIONS[2],
  ];
}
