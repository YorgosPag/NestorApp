'use client';

/**
 * StatusBarBimHoverLeaf — status-bar readout of the hovered BIM entity, for BOTH views.
 *
 * Unifies the 3D status-bar readout (formerly `StatusBarBim3DHoverLeaf`, Giorgio 2026-06-29)
 * with the 2D path (Giorgio 2026-06-30): the floating on-canvas card (`QuickPropertiesHoverPopover`)
 * no longer shows for BIM entities — their info reads INLINE here, right of the cursor coordinates,
 * exactly as in 3D.
 *
 * Two low-freq sources, one shared "Τύπος · διάσταση · κατηγορία" render:
 *   · 3D — `QuickProperties3DStore` (set by the 3D raycast hover) → `resolveBim3DHoverLines`.
 *   · 2D — `QuickPropertiesStore` (hovered entity id after the 800ms reveal) →
 *     `resolveBimHoverLinesById` (id-only; the 2D hover carries no BIM type), gated on
 *     `activeTool === 'select'` to mirror the popover it replaces.
 * Both resolvers read the SAME `Bim3DEntitiesStore` + `bim-entity-formatter` SSoT.
 *
 * ADR-040 micro-leaf: subscribes ONLY to the two low-freq hover stores (change on hover events,
 * not 60fps). Renders nothing when no BIM entity is hovered (3D store cleared + no 2D hover).
 *
 * ADR-366 B.2.Q1 / ADR-357.
 */

import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuickProperties3DStore } from '../../bim-3d/stores/QuickProperties3DStore';
import {
  resolveBim3DHoverLines,
  resolveBimHoverLinesById,
} from '../../bim-3d/properties/resolve-bim3d-hover-lines';
import { QuickPropertiesStore } from '../../systems/properties/QuickPropertiesStore';
import type { TooltipLines } from '../../bim-3d/properties/bim-entity-formatter';

interface StatusBarBimHoverLeafProps {
  className?: string;
  separatorClassName?: string;
  /** 2D active tool — the 2D hover readout only shows while selecting (parity with the popover). */
  activeTool?: string;
}

/** Inline "Τύπος · διάσταση · κατηγορία" for the hovered BIM entity (3D or 2D), or nothing. */
export function StatusBarBimHoverLeaf({ className, separatorClassName, activeTool }: StatusBarBimHoverLeafProps) {
  const { t } = useTranslation('bim3d');

  const hover3D = useSyncExternalStore(
    useQuickProperties3DStore.subscribe,
    useQuickProperties3DStore.getState,
    useQuickProperties3DStore.getState,
  );

  const hover2D = useSyncExternalStore(
    QuickPropertiesStore.subscribe,
    QuickPropertiesStore.getSnapshot,
    QuickPropertiesStore.getSnapshot,
  );

  let lines: TooltipLines | null = null;
  if (hover3D.hoveredBimId && hover3D.hoveredBimType) {
    // 3D hover wins when present (the 2D store stays cleared in 3D and vice-versa).
    lines = resolveBim3DHoverLines(hover3D.hoveredBimId, hover3D.hoveredBimType, t);
  } else if (hover2D.entityId && activeTool === 'select') {
    lines = resolveBimHoverLinesById(hover2D.entityId, t);
  }

  if (!lines) return null;
  const [typeLine, dimensionLine, categoryLine] = lines;

  return (
    <>
      <span className={separatorClassName}>|</span>
      <span className={className}>
        {typeLine} · {dimensionLine} · {categoryLine}
      </span>
    </>
  );
}
