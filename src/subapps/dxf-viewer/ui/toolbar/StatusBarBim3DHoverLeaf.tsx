'use client';

/**
 * StatusBarBim3DHoverLeaf — status-bar readout of the hovered 3D BIM entity.
 *
 * Replaces the floating cursor card (`QuickProperties3DHoverPopover`, removed per
 * Giorgio 2026-06-29): the same hover info now reads INLINE in the status bar, right
 * of the cursor coordinates.
 *
 * ADR-040 micro-leaf: subscribes ONLY to `QuickProperties3DStore` (low-freq — changes
 * on hover events, not 60fps). Reads `Bim3DEntitiesStore` once per render via the shared
 * `resolveBim3DHoverLines` SSoT (same store + formatter as the old card). Renders nothing
 * when no BIM entity is hovered (e.g. in the 2D view the store stays cleared).
 */

import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuickProperties3DStore } from '../../bim-3d/stores/QuickProperties3DStore';
import { resolveBim3DHoverLines } from '../../bim-3d/properties/resolve-bim3d-hover-lines';

interface StatusBarBim3DHoverLeafProps {
  className?: string;
  separatorClassName?: string;
}

/** Inline "Τύπος · διάσταση · κατηγορία" for the hovered 3D BIM entity (or nothing). */
export function StatusBarBim3DHoverLeaf({ className, separatorClassName }: StatusBarBim3DHoverLeafProps) {
  const { t } = useTranslation('bim3d');

  const state = useSyncExternalStore(
    useQuickProperties3DStore.subscribe,
    useQuickProperties3DStore.getState,
    useQuickProperties3DStore.getState,
  );

  const { hoveredBimId, hoveredBimType } = state;
  if (!hoveredBimId || !hoveredBimType) return null;

  const lines = resolveBim3DHoverLines(hoveredBimId, hoveredBimType, t);
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
