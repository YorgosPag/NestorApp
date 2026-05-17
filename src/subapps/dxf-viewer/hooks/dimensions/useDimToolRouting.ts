'use client';

/**
 * ADR-362 Phase D1 — Dim-tool routing layer for `useDrawingHandlers`.
 *
 * Adapts the orchestrator hook (`useDimensionCreate`) to the click / hover /
 * cancel event surface that `useDrawingHandlers` already implements for
 * line / circle / polyline / etc. Kept in its own module so the existing
 * orchestrator stays under the 500-line cap (Google SRP, CLAUDE.md N.7.1).
 *
 * Responsibilities:
 *   - Map ribbon `ToolType` → 'smart' or specific manual `DimensionType`.
 *   - Start the creation flow when the active tool flips to a dim tool;
 *     cancel when it flips away (auto-restart in continuous mode lives in
 *     `useDimensionCreate`).
 *   - Push the preview `DimensionEntity` to the existing `PreviewCanvas`
 *     after every click / hover dispatch.
 */

import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { DimensionEntity, DimensionType } from '../../types/dimension';
import type { Entity } from '../../types/entities';
import type { ToolType } from '../../ui/toolbar/types';
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas';
import { DXF_DEFAULT_LAYER } from '../../config/layer-config';
import { getLayer } from '../../stores/LayerStore';
import { dimensionCreateStore } from '../../stores/DimensionCreateStore';
import type { DetectableEntity } from '../../systems/dimensions/dim-smart-detector';
import { buildPreviewDimensionEntity } from './dimension-create-entity-builder';
import {
  useDimensionCreate,
  type DimensionCreateAPI,
  type DimensionCreateKey,
  type DimensionCreateStartInput,
} from './useDimensionCreate';
import { useDimensionKeyboardRouting } from './useDimensionKeyboardRouting';

// ──────────────────────────────────────────────────────────────────────────────
// Tool → creation-flow input mapping
// ──────────────────────────────────────────────────────────────────────────────

const DIM_TOOL_INPUTS: Readonly<Partial<Record<ToolType, DimensionCreateStartInput>>> = {
  'dim-smart': 'smart',
  'dim-linear': 'linear',
  'dim-aligned': 'aligned',
  'dim-angular2L': 'angular2L',
  'dim-angular3P': 'angular3P',
  // ADR-362 Phase D2 — radial family + ordinate
  'dim-radius': 'radius',
  'dim-diameter': 'diameter',
  'dim-arc-length': 'arcLength',
  'dim-jogged-radius': 'joggedRadius',
  'dim-ordinate': 'ordinate',
  // ADR-362 Phase D3 — chained dims
  'dim-baseline': 'baseline',
  'dim-continued': 'continued',
};

export function isDimTool(tool: ToolType): boolean {
  return tool in DIM_TOOL_INPUTS;
}

// ──────────────────────────────────────────────────────────────────────────────
// Hook API
// ──────────────────────────────────────────────────────────────────────────────

export interface UseDimToolRoutingParams {
  readonly activeTool: ToolType;
  readonly onEntityCreated: (entity: Entity) => void;
  readonly previewCanvasRef?: React.RefObject<PreviewCanvasHandle>;
}

export interface DimToolRoutingAPI {
  readonly isDimTool: boolean;
  readonly handlePoint: (world: Point2D, hoveredEntity?: DetectableEntity) => void;
  readonly handleHover: (world: Point2D | null, hoveredEntity?: DetectableEntity) => void;
  readonly handleCancel: () => void;
  readonly handleKey: (key: DimensionCreateKey) => void;
}

export function useDimToolRouting(params: UseDimToolRoutingParams): DimToolRoutingAPI {
  const { activeTool, onEntityCreated, previewCanvasRef } = params;
  const previewRef = useRef(previewCanvasRef);
  previewRef.current = previewCanvasRef;

  const onEntityCreatedRef = useRef(onEntityCreated);
  onEntityCreatedRef.current = onEntityCreated;

  const dimCreate = useDimensionCreate({
    onDimensionCreated: (entity: DimensionEntity) => {
      onEntityCreatedRef.current(entity as unknown as Entity);
      previewRef.current?.current?.clear();
    },
    resolveLayerId,
  });

  // Tool lifecycle: start / cancel when activeTool toggles in or out of dim.
  const lastDimToolRef = useRef<ToolType | null>(null);
  useEffect(() => {
    return manageDimToolLifecycle(activeTool, lastDimToolRef, dimCreate, previewRef);
  }, [activeTool, dimCreate]);

  // Phase D3 — Q-C live Tab/Space/Escape routing from the canvas. Active only
  // when the current tool is a dim tool; gate inside the hook prevents stray
  // events from reaching the store when focus is on the ribbon / input fields.
  useDimensionKeyboardRouting({
    activeTool,
    isDimTool,
    onKey: dimCreate.onKey,
  });

  const handlePoint = useCallback(
    (world: Point2D, hoveredEntity?: DetectableEntity) => {
      dimCreate.onClick(world, hoveredEntity);
      pushPreview(previewRef);
    },
    [dimCreate],
  );

  const handleHover = useCallback(
    (world: Point2D | null, hoveredEntity?: DetectableEntity) => {
      if (!world) {
        previewRef.current?.current?.clear();
        return;
      }
      dimCreate.onCursorMove(world, hoveredEntity);
      pushPreview(previewRef);
    },
    [dimCreate],
  );

  const handleCancel = useCallback(() => {
    dimCreate.cancel();
    previewRef.current?.current?.clear();
  }, [dimCreate]);

  return {
    isDimTool: isDimTool(activeTool),
    handlePoint,
    handleHover,
    handleCancel,
    handleKey: dimCreate.onKey,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Internals
// ──────────────────────────────────────────────────────────────────────────────

function resolveLayerId(): string {
  // Phase D1 — use the active layer or the DXF default. Real DIMSTYLE
  // `targetLayer` enforcement ships in Phase D5.
  return getLayer(DXF_DEFAULT_LAYER)?.id ?? '0';
}

function manageDimToolLifecycle(
  activeTool: ToolType,
  lastDimToolRef: React.MutableRefObject<ToolType | null>,
  dimCreate: DimensionCreateAPI,
  previewRef: React.MutableRefObject<React.RefObject<PreviewCanvasHandle> | undefined>,
): (() => void) | undefined {
  const input = DIM_TOOL_INPUTS[activeTool];
  if (input) {
    if (lastDimToolRef.current !== activeTool) {
      dimCreate.start(input);
      lastDimToolRef.current = activeTool;
    }
    return undefined;
  }
  // Switched away from a dim tool — clean up if a flow was active.
  if (lastDimToolRef.current) {
    dimCreate.cancel();
    previewRef.current?.current?.clear();
    lastDimToolRef.current = null;
  }
  return undefined;
}

function pushPreview(
  previewRef: React.MutableRefObject<React.RefObject<PreviewCanvasHandle> | undefined>,
): void {
  const canvas = previewRef.current?.current;
  if (!canvas) return;
  const entity = buildPreviewDimensionEntity(dimensionCreateStore.get());
  if (!entity) {
    canvas.clear();
    return;
  }
  // Cast: PreviewCanvas API was authored for `ExtendedSceneEntity`; the
  // dim preview path was added in PreviewRenderer ('dimension' switch case).
  canvas.drawPreview(entity as unknown as Parameters<typeof canvas.drawPreview>[0]);
}
