'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-362 Round 35 — «Λαβές Μετακίνησης Σειρών» (dimension row-move handles).
 *
 * Dedicated micro-leaf overlay (ADR-040): when `DimRowHandleModeStore` is ON it
 * draws ONE handle per dimension row, DOCKED at the viewport edge (screen-space —
 * Giorgio «στα άκρα της οθόνης»), so a stacked band of measurements can be dragged
 * perpendicular to its axis without selecting it first. Dragging shows a WYSIWYG
 * ghost of the shifted dim lines; on release the overlay emits `dim:row-move-requested`
 * and the `useDimensionModify` host commits ONE atomic-undo command.
 *
 * ADR-040: this is an SVG sibling leaf — `pointer-events:none` except on the handle
 * circles, so pan / select / zoom under it are untouched. The orchestrator
 * (CanvasSection / CanvasLayerStack shell) gains NO `useSyncExternalStore`; only this
 * leaf subscribes (mode store + live scene). `transform` / `viewport` arrive as props
 * (Bridge-fed), so the handles reposition on pan/zoom via the shell's normal re-render.
 *
 * SSoT reuse: `partitionDimensionRows` (rows) · `computeRowHandleScreenPos` /
 * `computeRowGhostSegments` / `projectRowDelta` (geometry) · `CoordinateTransforms`
 * (world↔screen). Zero parallel math.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ViewTransform, Viewport, Point2D } from '../../rendering/types/Types';
import type { DimensionEntity } from '../../types/dimension';
import { isDimensionEntity, type Entity } from '../../types/entities';
import { useLevelScene } from '../../systems/scene/useSceneSelectors';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { EventBus } from '../../systems/events/EventBus';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useDimRowHandleModeActive } from '../../systems/dimensions/DimRowHandleModeStore';
import { partitionDimensionRows, type DimRow } from '../../systems/dimensions/dim-row-partition';
import {
  computeRowHandleScreenPos,
  computeRowGhostSegments,
  projectRowDelta,
} from '../../systems/dimensions/dim-row-handle-geometry';

export interface DimRowHandleOverlayProps {
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
  readonly currentLevelId: string | null;
}

/** Per-gesture drag snapshot (transient — never in the store). */
interface DragState {
  readonly rowId: string;
  readonly entityIds: string[];
  readonly normal: Point2D;
  readonly startWorld: Point2D;
  readonly dims: readonly DimensionEntity[];
  readonly delta: Point2D;
  readonly rect: { left: number; top: number };
}

function DimRowHandleOverlayInner({ transform, viewport, currentLevelId }: DimRowHandleOverlayProps) {
  const active = useDimRowHandleModeActive();
  const sceneModel = useLevelScene(currentLevelId);
  const colors = useSemanticColors();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const rows = useMemo<DimRow[]>(() => {
    if (!active || !sceneModel) return [];
    const dims = (sceneModel.entities as unknown as Entity[]).filter(isDimensionEntity);
    return partitionDimensionRows(dims);
  }, [active, sceneModel]);

  const handles = useMemo(() => {
    const out: { row: DimRow; screen: Point2D }[] = [];
    for (const row of rows) {
      const p = computeRowHandleScreenPos(row.info, transform, viewport);
      if (p) out.push({ row, screen: p.screen });
    }
    return out;
  }, [rows, transform, viewport]);

  const beginDrag = useCallback(
    (row: DimRow, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const startLocal = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const startWorld = CoordinateTransforms.screenToWorld(startLocal, transform, viewport);
      const snapshot: DragState = {
        rowId: row.id,
        entityIds: row.dims.map((d) => d.id),
        normal: row.info.normal,
        startWorld,
        dims: row.dims,
        delta: { x: 0, y: 0 },
        rect: { left: rect.left, top: rect.top },
      };
      dragRef.current = snapshot;
      setDrag(snapshot);
    },
    [transform, viewport],
  );

  const dragRowId = drag?.rowId ?? null;
  useEffect(() => {
    if (!dragRowId) return;
    const move = (ev: PointerEvent): void => {
      const cur = dragRef.current;
      if (!cur) return;
      const local = { x: ev.clientX - cur.rect.left, y: ev.clientY - cur.rect.top };
      const world = CoordinateTransforms.screenToWorld(local, transform, viewport);
      const worldDelta = { x: world.x - cur.startWorld.x, y: world.y - cur.startWorld.y };
      const next = { ...cur, delta: projectRowDelta(worldDelta, cur.normal) };
      dragRef.current = next;
      setDrag(next);
    };
    const up = (): void => {
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (d && (d.delta.x !== 0 || d.delta.y !== 0)) {
        EventBus.emit('dim:row-move-requested', { entityIds: d.entityIds, delta: d.delta });
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [dragRowId, transform, viewport]);

  if (!active) return null;

  const w2s = (p: Point2D): Point2D => CoordinateTransforms.worldToScreen(p, transform, viewport);
  const ghostSegs = drag ? computeRowGhostSegments(drag.dims, drag.delta) : [];

  return (
    <svg
      ref={svgRef}
      width={viewport.width}
      height={viewport.height}
      aria-hidden="true"
      className={`absolute inset-0 w-full h-full ${PANEL_LAYOUT.POINTER_EVENTS.NONE} ${PANEL_LAYOUT.Z_INDEX['30']}`}
    >
      <g className={colors.text.secondary}>
        {ghostSegs.map((s, i) => {
          const a = w2s(s.a);
          const b = w2s(s.b);
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="currentColor"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              opacity={0.9}
            />
          );
        })}
      </g>
      <g className={colors.text.info}>
        {handles.map(({ row, screen }) => {
          const armed = drag?.rowId === row.id;
          return (
            <circle
              key={row.id}
              cx={screen.x}
              cy={screen.y}
              r={9}
              fill="currentColor"
              fillOpacity={armed ? 0.9 : 0.35}
              stroke="currentColor"
              strokeWidth={2}
              className={`pointer-events-auto ${armed ? 'cursor-grabbing' : 'cursor-grab'}`}
              onPointerDown={(e) => beginDrag(row, e)}
            />
          );
        })}
      </g>
    </svg>
  );
}

export const DimRowHandleOverlay = React.memo(DimRowHandleOverlayInner);
