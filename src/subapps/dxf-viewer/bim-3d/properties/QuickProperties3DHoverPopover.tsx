"use client";

/**
 * QuickProperties3DHoverPopover — ADR-040 micro-leaf tooltip.
 *
 * Subscribes ONLY to QuickProperties3DStore (low-freq: changes on hover events,
 * not 60fps). Reads Bim3DEntitiesStore once per render (getState, not subscribe).
 * Renders the Revit-style 3-line entity info card near the cursor.
 *
 * Positioned via fixed + clientX/Y (cursor-relative). pointer-events:none.
 * ADR-366 B.2.Q1.
 */

import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuickProperties3DStore } from '../stores/QuickProperties3DStore';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import {
  formatWallTooltip,
  formatColumnTooltip,
  formatBeamTooltip,
  formatSlabTooltip,
  type TFn,
  type TooltipLines,
} from './bim-entity-formatter';

const OFFSET_X = 16;
const OFFSET_Y = 18;

function resolveLines(
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

export function QuickProperties3DHoverPopover() {
  const { t } = useTranslation('bim3d');

  const state = useSyncExternalStore(
    useQuickProperties3DStore.subscribe,
    useQuickProperties3DStore.getState,
    useQuickProperties3DStore.getState,
  );

  const { hoveredBimId, hoveredBimType, cursorX, cursorY } = state;
  if (!hoveredBimId || !hoveredBimType) return null;

  const lines = resolveLines(hoveredBimId, hoveredBimType, t);
  if (!lines) return null;

  const [typeLine, dimensionLine, categoryLine] = lines;

  return (
    <div
      className="pointer-events-none fixed z-[300] min-w-[140px] select-none rounded border border-white/15 bg-black/75 px-3 py-2 text-xs text-white/90 shadow-lg backdrop-blur-sm"
      style={{ left: cursorX + OFFSET_X, top: cursorY + OFFSET_Y }}
      aria-hidden="true"
    >
      <p className="font-semibold leading-tight">{typeLine}</p>
      <p className="mt-0.5 font-mono leading-tight text-white/70">{dimensionLine}</p>
      <p className="mt-0.5 leading-tight text-white/55">{categoryLine}</p>
    </div>
  );
}
