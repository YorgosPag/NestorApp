'use client';

import { useEffect, useRef } from 'react';
// ADR-532 Stage 5 — non-reactive facade: this hook needs ONLY the stable
// `clearAll` method (read through a ref), never the reactive selection value.
// Subscribing via `useUniversalSelection` re-rendered the `DxfViewerContent`
// orchestrator on every click (one of its 3 selection-leak hooks). The stable
// facade exposes the same methods (live store reads) without the version sub.
import { useUniversalSelectionStable } from './SelectionSystem';

/**
 * ADR-420 — reset the 2D universal selection whenever the active floor changes.
 *
 * The 2D selection (`universalSelection` Map) is a single global reducer, not a
 * per-level store. Without this reset, a selection made on one floor (e.g.
 * `Ctrl+A` → all entity ids of the Ground floor scene) survived navigation and
 * the carried-over ids rendered as "selected" on the next floor — the UI mirror
 * of the cross-floor BIM scope leak (ADR-420). Revit behaviour: switching the
 * active view clears the selection (each storey is its own independent space).
 *
 * Mirrors `useLevelId3DSync` (the 3D side already re-targets its store on level
 * switch). Single instance — call it once from `DxfViewerContent`, which lives
 * inside BOTH the `SelectionSystem` provider (for the selection facade) and
 * the `LevelsSystem` provider (for `currentLevelId`).
 *
 * The clear runs only on an ACTUAL level change, not on first mount, so an empty
 * initial selection isn't needlessly churned. `clearAll` is read through a ref so
 * the effect depends solely on `currentLevelId` (the selection object identity
 * changes every selection edit and must NOT re-trigger the reset).
 */
export function useSelectionLevelReset(currentLevelId: string | null): void {
  const selection = useUniversalSelectionStable();
  const clearRef = useRef(selection.clearAll);
  clearRef.current = selection.clearAll;

  const prevLevelIdRef = useRef<string | null>(currentLevelId);
  useEffect(() => {
    if (prevLevelIdRef.current === currentLevelId) return;
    prevLevelIdRef.current = currentLevelId;
    clearRef.current();
  }, [currentLevelId]);
}
