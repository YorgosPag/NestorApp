'use client';

/**
 * ADR-452 — useCutPlaneRange: reactive cut-plane slider range for the active storey.
 *
 * FFL-relative (Revit View Range per-level): the range is `0 … storeyHeightMm` of
 * the active storey, read from `useActiveStoreyContext()`. Pure range math lives in
 * `./cut-plane-range`. Returns `null` when there is no active storey (slider hides).
 */

import { useMemo } from 'react';
import { useActiveStoreyContext } from '../../systems/levels/useActiveStoreySync';
import { computeCutPlaneRange, type CutPlaneRange } from './cut-plane-range';

export type { CutPlaneRange } from './cut-plane-range';

/** Reactive hook: cut-plane range for the active storey (null = no storey). */
export function useCutPlaneRange(): CutPlaneRange | null {
  const storey = useActiveStoreyContext();
  const storeyHeightMm = storey?.storeyHeightMm ?? null;
  return useMemo(() => computeCutPlaneRange(storeyHeightMm), [storeyHeightMm]);
}
