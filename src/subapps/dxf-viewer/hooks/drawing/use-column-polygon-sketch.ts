/**
 * ADR-363 §column-polygon-sketch — «Κολώνα από σχεδιασμένο πολύγωνο» sub-hook.
 *
 * N.7.1 file-size split out of `useColumnTool`. Encapsulates the whole polygon-sketch
 * concern: the commit adapter (`buildColumnFromSketchedPolygon` → ΕΝΑ `ColumnEntity`),
 * the shared vertex-chain FSM (`usePolygonSketchChain`, ίδιο engine με το slab), the
 * activate/deactivate lifecycle (only while `placementMode==='polygon'` & active) and
 * the live rubber-band preview publish (`columnPolygonPreviewStore`).
 *
 * Mirrors the sibling extracted column sub-hooks (`useColumnPerimeterCommit`,
 * `useColumnRegionClicks`, `useColumnRectAdopt`) — the orchestrator wires it and reads
 * back `onCanvasClick` + `phase` (for the status text).
 */

import { useCallback, useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { ColumnEntity } from '../../bim/types/column-types';
import type { SceneUnits } from './column-completion';
import type { ColumnPlacementMode, ColumnToolPhase } from './column-tool-types';
import { usePolygonSketchChain, type PolygonSketchPhase } from './use-polygon-sketch-chain';
import { buildColumnFromSketchedPolygon } from '../../bim/columns/column-from-sketched-polygon';
import { columnPolygonPreviewStore } from '../../bim/columns/column-polygon-preview-store';
import { EventBus } from '../../systems/events/EventBus';

export interface UseColumnPolygonSketchOptions {
  readonly currentLevelId: string;
  /** Live column FSM placement mode — the chain runs ONLY while this is `'polygon'`. */
  readonly placementMode: ColumnPlacementMode;
  /** Live column FSM phase — chain deactivates when this returns to `'idle'`. */
  readonly phase: ColumnToolPhase;
  readonly getSceneUnits?: () => SceneUnits;
  readonly getSceneEntities?: () => readonly Entity[];
  readonly getSceneUnitsRef: MutableRefObject<(() => SceneUnits) | undefined>;
  readonly appendColumnsRef: MutableRefObject<(entities: readonly ColumnEntity[]) => void>;
}

export interface UseColumnPolygonSketchResult {
  /** Delegate a canvas click to the vertex chain (returns true = consumed). */
  readonly onCanvasClick: (point: Readonly<Point2D>) => boolean;
  /** Current chain phase — feeds the tool status text resolver. */
  readonly phase: PolygonSketchPhase;
}

export function useColumnPolygonSketch(
  options: UseColumnPolygonSketchOptions,
): UseColumnPolygonSketchResult {
  const {
    currentLevelId,
    placementMode,
    phase,
    getSceneUnits,
    getSceneEntities,
    getSceneUnitsRef,
    appendColumnsRef,
  } = options;

  // Commit: the sketched closed polygon → ΕΝΑ ColumnEntity via the SAME builder as the
  // «από περίγραμμα» path (`buildColumnFromSketchedPolygon` → `buildColumnsFromPerimeters`).
  const commitSketchedColumn = useCallback(
    (vertices: readonly Point2D[]): boolean => {
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const entity = buildColumnFromSketchedPolygon(vertices, currentLevelId, sceneUnits);
      if (!entity) return false;
      appendColumnsRef.current([entity]);
      EventBus.emit('bim:columns-from-perimeter', { built: 1, ignored: 0 });
      return true;
    },
    [currentLevelId, getSceneUnitsRef, appendColumnsRef],
  );

  const {
    activate: sketchActivate,
    deactivate: sketchDeactivate,
    onCanvasClick,
    phase: sketchPhase,
    vertices: sketchVertices,
    isActive: sketchIsActive,
  } = usePolygonSketchChain({ onCommit: commitSketchedColumn, getSceneUnits, getSceneEntities });

  // Chain lifecycle — active ONLY while the tool is in polygon mode & not idle. One
  // synchronizing effect keeps the chain in sync with the column FSM (no wrapping of
  // every lifecycle action).
  useEffect(() => {
    const wantActive = placementMode === 'polygon' && phase !== 'idle';
    if (wantActive && !sketchIsActive) sketchActivate();
    else if (!wantActive && sketchIsActive) sketchDeactivate();
  }, [placementMode, phase, sketchIsActive, sketchActivate, sketchDeactivate]);

  // Live-preview publish (tool-agnostic rubber-band outline).
  useEffect(() => {
    if (placementMode !== 'polygon' || sketchPhase === 'idle') {
      columnPolygonPreviewStore.reset();
      return;
    }
    columnPolygonPreviewStore.set({ vertices: sketchVertices });
  }, [placementMode, sketchPhase, sketchVertices]);

  useEffect(() => {
    return () => columnPolygonPreviewStore.reset();
  }, []);

  return { onCanvasClick, phase: sketchPhase };
}
