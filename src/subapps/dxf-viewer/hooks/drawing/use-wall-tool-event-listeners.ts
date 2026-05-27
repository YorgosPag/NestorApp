/**
 * ADR-363 — Wall Tool side-effect listeners (extracted from `useWallTool` for N.7.1).
 *
 * Two listeners that wire wall-tool React state to platform events:
 *   - `useWallToolDynamicInputListener` — `dynamic-input-coordinate-submit` window event
 *   - `useWallToolEnterListener` — global keydown→Enter commit for polyline chain
 *
 * Both consume the parent hook's `stateRef` + `setState` + commit closures so
 * behavior parity with the previously-inlined `useEffect` blocks is bit-for-bit identical.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 1C
 */

import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { DynamicSubmitDetail } from '../../systems/dynamic-input/utils/events';
import type { WallParamOverrides } from './wall-completion';
import type { WallToolState } from './useWallTool';

export interface WallToolListenerCtx {
  readonly stateRef: MutableRefObject<WallToolState>;
  readonly setState: Dispatch<SetStateAction<WallToolState>>;
  readonly commitStraightFromState: (
    s: WallToolState,
    endPoint: Readonly<Point2D>,
    alignmentPoint?: Readonly<Point2D> | null,
  ) => boolean;
  readonly commitCurvedFromState: (
    s: WallToolState,
    controlPoint: Readonly<Point2D>,
  ) => boolean;
}

/**
 * Dynamic Input commit-wall listener — when overlay submits an explicit
 * coordinate (length+angle / x,y), commit atomically with current overrides.
 * Inline overrides (height/thickness/category/flip) flow through the same event.
 */
export function useWallToolDynamicInputListener(ctx: WallToolListenerCtx): void {
  const { stateRef, setState, commitStraightFromState, commitCurvedFromState } = ctx;
  useEffect(() => {
    const onDynSubmit = (e: Event) => {
      const ce = e as CustomEvent<DynamicSubmitDetail>;
      if (!ce.detail || ce.detail.tool !== 'wall') return;
      if (ce.detail.action !== 'commit-wall') return;
      const s = stateRef.current;
      const inlineOverrides: WallParamOverrides = {
        ...(typeof ce.detail.height === 'number' ? { height: ce.detail.height } : {}),
        ...(typeof ce.detail.thickness === 'number' ? { thickness: ce.detail.thickness } : {}),
        ...(typeof ce.detail.category === 'string'
          ? { category: ce.detail.category as WallParamOverrides['category'] }
          : {}),
        ...(typeof ce.detail.flip === 'boolean' ? { flip: ce.detail.flip } : {}),
      };
      const mergedState: WallToolState =
        Object.keys(inlineOverrides).length > 0
          ? { ...s, overrides: { ...s.overrides, ...inlineOverrides } }
          : s;

      const target = ce.detail.coordinates ?? ce.detail.secondPoint;
      if (!target) return;

      if (s.kind === 'polyline') {
        if (s.phase === 'awaitingNextVertex') {
          setState({
            ...mergedState,
            polylineVertices: [...mergedState.polylineVertices, { x: target.x, y: target.y }],
            error: null,
          });
        }
        return;
      }
      if (s.kind === 'curved') {
        if (s.phase === 'awaitingEnd') {
          setState({
            ...mergedState,
            phase: 'awaitingCurveControl',
            endPoint: { x: target.x, y: target.y },
            error: null,
          });
          return;
        }
        if (s.phase === 'awaitingCurveControl' && s.startPoint && s.endPoint) {
          commitCurvedFromState(mergedState, target);
          return;
        }
        return;
      }
      // ADR-363 Phase 1F — DI is the precision path. Explicit numeric submit at
      // `awaitingEnd` commits centered on A→B, BYPASSING the 3-click alignment.
      // Manual mouse-click users still get the strict 3-click flow.
      if (s.phase === 'awaitingEnd' && mergedState.startPoint) {
        commitStraightFromState(mergedState, target);
      } else if (
        s.phase === 'awaitingAlignment' &&
        mergedState.startPoint &&
        mergedState.endPoint
      ) {
        commitStraightFromState(mergedState, mergedState.endPoint, target);
      }
    };
    window.addEventListener('dynamic-input-coordinate-submit', onDynSubmit);
    return () => window.removeEventListener('dynamic-input-coordinate-submit', onDynSubmit);
  }, [stateRef, setState, commitStraightFromState, commitCurvedFromState]);
}

export interface WallToolEnterListenerCtx {
  readonly stateRef: MutableRefObject<WallToolState>;
  readonly commitPolylineFromState: (s: WallToolState) => boolean;
}

/**
 * Enter / double-click to finish polyline (Phase 1C). Industry convention
 * (AutoCAD PLINE, Revit Wall): Enter on the last vertex commits the chain.
 * Stays inert outside `awaitingNextVertex` so it does not clobber other tools.
 */
export function useWallToolEnterListener(ctx: WallToolEnterListenerCtx): void {
  const { stateRef, commitPolylineFromState } = ctx;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const s = stateRef.current;
      if (s.kind !== 'polyline' || s.phase !== 'awaitingNextVertex') return;
      // Avoid swallowing Enter when an editable element is focused (DI fields
      // handle their own Enter → submit event).
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      )
        return;
      const ok = commitPolylineFromState(s);
      if (ok) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [stateRef, commitPolylineFromState]);
}
