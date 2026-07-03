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
import type { Entity } from '../../types/entities';
import { EventBus } from '../../systems/events/EventBus';
import {
  extractLineSegments,
  findRectanglesFromSegments,
  type DetectedRectangle,
} from '../../bim/walls/wall-in-region';
import { perimeterFacesToRects, type PerimeterFacesResult } from '../../bim/walls/perimeter-from-faces';
import { defaultEdgeAlignmentPoint, type WallParamOverrides } from './wall-completion';
import type { WallToolState } from './wall-tool-types';
// ADR-565 §12 Φ1.x — share the per-variant curved click FSM with the Dynamic-Input path.
import { resolveCurvedClickTransition } from './wall-curved-click-fsm';

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
  /** ADR-565 §12 Φ1.x — «αρχή-τέλος-ακτίνα»: commit από πληκτρολογημένη ακτίνα (mm). */
  readonly commitCurvedRadius: (
    s: WallToolState,
    radiusMm: number,
    sidePoint: Readonly<Point2D>,
  ) => boolean;
}

/**
 * Dynamic Input commit-wall listener — when overlay submits an explicit
 * coordinate (length+angle / x,y), commit atomically with current overrides.
 * Inline overrides (height/thickness/category/flip) flow through the same event.
 */
export function useWallToolDynamicInputListener(ctx: WallToolListenerCtx): void {
  const { stateRef, setState, commitStraightFromState, commitCurvedFromState, commitCurvedRadius } = ctx;
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
        // «αρχή-τέλος-ακτίνα»: πληκτρολογημένη ακτίνα (length mm) + cursor (side) → commit.
        if (
          s.arcVariant === 'start-end-radius' &&
          s.phase === 'awaitingCurveControl' &&
          typeof ce.detail.length === 'number' &&
          s.startPoint &&
          s.endPoint
        ) {
          commitCurvedRadius(mergedState, ce.detail.length, target);
          return;
        }
        // Otherwise route the coordinate submit through the SAME per-variant FSM as a click.
        const tr = resolveCurvedClickTransition(mergedState, target);
        if (tr.kind === 'commit') commitCurvedFromState(mergedState, target);
        else if (tr.kind === 'advance') setState(tr.next);
        return;
      }
      // ADR-363 "Location Line = Finish Face" — DI is the precision path. Explicit
      // numeric submit at `awaitingEnd` commits with the drawn A→B line on one wall
      // FACE (edge), body to the default side — matching the awaitingEnd rubber-band
      // preview (WYSIWYG). Manual mouse-click users still get the strict 3-click flow
      // where the side is re-picked at click 3.
      if (s.phase === 'awaitingEnd' && mergedState.startPoint) {
        commitStraightFromState(mergedState, target, defaultEdgeAlignmentPoint(mergedState.startPoint, target));
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

export interface WallToolRegionBoxSelectCtx {
  readonly stateRef: MutableRefObject<WallToolState>;
  readonly getSceneEntities?: () => readonly Entity[];
  readonly regionTol: () => number;
  readonly commitInRegionRects: (
    s: WallToolState,
    rects: readonly DetectedRectangle[],
  ) => boolean;
}

/**
 * ADR-363 Phase 1K Mode C — box-select: a drag-rectangle marquee in the
 * wall-in-region tool collects line ids (mouse-up handler → EventBus). Re-read
 * the live scene, keep only the selected lines, detect EVERY enclosed rectangle
 * among them, and build one filling wall per rectangle. Inert unless in-region
 * placement is engaged.
 */
export function useWallToolRegionBoxSelectListener(ctx: WallToolRegionBoxSelectCtx): void {
  const { stateRef, getSceneEntities, regionTol, commitInRegionRects } = ctx;
  useEffect(
    () =>
      EventBus.on('bim:wall-region-box-select', ({ entityIds }) => {
        const s = stateRef.current;
        if (s.placementMode !== 'in-region' || s.phase === 'idle') return;
        // ADR-419 — box-select μόνο για την «με πλαίσιο» εντολή (wall-region-box).
        if (s.regionMethod !== 'box') return;
        const idSet = new Set(entityIds);
        const segs = extractLineSegments(
          (getSceneEntities?.() ?? []).filter((e) => idSet.has(e.id)),
        );
        const rects = findRectanglesFromSegments(segs, regionTol());
        if (rects.length > 0) commitInRegionRects(s, rects);
      }),
    [stateRef, getSceneEntities, regionTol, commitInRegionRects],
  );
}

export interface WallToolPerimeterBoxSelectCtx {
  readonly stateRef: MutableRefObject<WallToolState>;
  readonly getSceneEntities?: () => readonly Entity[];
  readonly regionTol: () => number;
  readonly commitPerimeterFaces: (s: WallToolState, result: PerimeterFacesResult) => boolean;
}

/**
 * ADR-363 «Τοίχος από περίγραμμα» Mode — box-select the faces of a structural element:
 * a drag-rectangle marquee collects the boundary entity ids (mouse-up → EventBus),
 * the analyser finds the outer perimeter(s), classifies the shape (rectangle / Γ / Τ /
 * Π / σύνθετο) and decomposes each into ορθογώνια σκέλη → one filling wall per leg
 * (thickness from the geometry). Garbage shapes feed the «αγνοήθηκαν» toast count.
 * Inert unless outer-perimeter placement is engaged.
 */
export function useWallToolPerimeterBoxSelectListener(ctx: WallToolPerimeterBoxSelectCtx): void {
  const { stateRef, getSceneEntities, regionTol, commitPerimeterFaces } = ctx;
  useEffect(
    () =>
      EventBus.on('bim:wall-region-box-select', ({ entityIds }) => {
        const s = stateRef.current;
        if (s.placementMode !== 'outer-perimeter' || s.phase === 'idle') return;
        const idSet = new Set(entityIds);
        const selected = (getSceneEntities?.() ?? []).filter((e) => idSet.has(e.id));
        const result = perimeterFacesToRects(selected, regionTol());
        if (result.perimeters.length > 0) commitPerimeterFaces(s, result);
      }),
    [stateRef, getSceneEntities, regionTol, commitPerimeterFaces],
  );
}
