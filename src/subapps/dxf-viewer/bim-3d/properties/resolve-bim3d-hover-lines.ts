/**
 * resolve-bim3d-hover-lines — SSoT resolver: hovered BIM id/type → tooltip lines.
 *
 * Reads Bim3DEntitiesStore once (getState, not subscribe) and delegates the actual
 * text to the pure `bim-entity-formatter`. Extracted from QuickProperties3DHoverPopover
 * so BOTH the (legacy) floating card AND the status-bar leaf share ONE lookup+format
 * path — no duplicate switch/formatter wiring.
 *
 * ADR-366 B.2.Q1 / ADR-402 §gizmo-cleanup follow-up (hover info → status bar).
 */

import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import {
  formatWallTooltip,
  formatColumnTooltip,
  formatBeamTooltip,
  formatSlabTooltip,
  type TFn,
  type TooltipLines,
} from './bim-entity-formatter';

/** Resolve the 3-line tooltip for a hovered BIM entity, or null when not found. */
export function resolveBim3DHoverLines(
  bimId: string,
  bimType: string,
  t: TFn,
): TooltipLines | null {
  const { walls, columns, beams, slabs } = useBim3DEntitiesStore.getState();
  switch (bimType) {
    case 'wall': {
      const e = walls.find((w) => w.id === bimId);
      return e ? formatWallTooltip(e, t) : null;
    }
    case 'column': {
      const e = columns.find((c) => c.id === bimId);
      return e ? formatColumnTooltip(e, t) : null;
    }
    case 'beam': {
      const e = beams.find((b) => b.id === bimId);
      return e ? formatBeamTooltip(e, t) : null;
    }
    case 'slab': {
      const e = slabs.find((s) => s.id === bimId);
      return e ? formatSlabTooltip(e, t) : null;
    }
    default:
      return null;
  }
}

/**
 * Resolve the 3-line tooltip from JUST a BIM id (no type) — the 2D hover path carries only
 * the hovered entity id (`HoverStore`/`QuickPropertiesStore`), not its BIM type. Searches the
 * supported slices (wall → column → beam → slab) in `Bim3DEntitiesStore` (live in 2D, fed by
 * the always-mounted PersistenceHosts) and reuses the SAME formatters as the typed resolver —
 * one lookup+format path for both views. Returns null when the id is none of the 4 (e.g. a
 * BIM type without a formatter yet, or a plain DXF entity). Giorgio 2026-06-30.
 */
export function resolveBimHoverLinesById(bimId: string, t: TFn): TooltipLines | null {
  const { walls, columns, beams, slabs } = useBim3DEntitiesStore.getState();
  const wall = walls.find((w) => w.id === bimId);
  if (wall) return formatWallTooltip(wall, t);
  const column = columns.find((c) => c.id === bimId);
  if (column) return formatColumnTooltip(column, t);
  const beam = beams.find((b) => b.id === bimId);
  if (beam) return formatBeamTooltip(beam, t);
  const slab = slabs.find((s) => s.id === bimId);
  if (slab) return formatSlabTooltip(slab, t);
  return null;
}
