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
import { registerRenderCallback, RENDER_PRIORITIES } from '../../rendering';
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
import { handleToolCompletion } from '../drawing/drawing-handler-utils';
// ADR-364 — Escape Command Bus SSoT
import { useEscapeHandler, ESC_PRIORITY } from '../../systems/escape-bus';

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
  /** Called when Escape is pressed — allows the parent to switch back to 'select'. */
  readonly onToolChange?: (tool: ToolType) => void;
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

  const onToolChangeRef = useRef(params.onToolChange);
  onToolChangeRef.current = params.onToolChange;

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

  // RAF persist: re-push dim preview every frame while dim tool is active.
  // Survives any external canvas.clear() calls (e.g. markAllCanvasDirty path)
  // that would otherwise erase the rubber-band line when the cursor stops.
  useEffect(() => {
    if (!isDimTool(activeTool)) return;
    const unregister = registerRenderCallback(
      'dim-preview-persist',
      'Dim Preview Persist',
      RENDER_PRIORITIES.NORMAL,
      () => { pushPreview(previewRef); },
    );
    return unregister;
  }, [activeTool, previewRef]);

  // Wrap onKey: on Escape → also clear preview + switch back to 'select'.
  // AutoCAD pattern: Escape exits the active command entirely, not just the
  // current collection step. `onToolChangeRef` avoids stale closure.
  const wrappedOnKey = useCallback((key: DimensionCreateKey) => {
    dimCreate.onKey(key);
    if (key === 'Escape') {
      previewRef.current?.current?.clear();
      onToolChangeRef.current?.('select');
      // Belt-and-suspenders: bypass React props chain timing — directly set
      // activeTool='select' in the store. Fixes 2-press Escape (ADR-362 hotfix).
      handleToolCompletion(activeTool, true);
    }
  }, [dimCreate, activeTool]);

  // Phase D3 — Q-C live Tab / Space / Enter routing from the canvas.
  // ADR-364: Escape moved to the centralized EscapeCommandBus (below).
  useDimensionKeyboardRouting({
    activeTool,
    isDimTool,
    onKey: wrappedOnKey,
  });

  // ADR-364 — DIM_TOOL priority slot in the EscapeCommandBus.
  // `allowWhenEditable: true` so ESC still cancels the dim flow when focus
  // is parked inside the dynamic-input field (we blur it first to commit
  // any pending value, matching the legacy useDimensionKeyboardRouting path).
  useEscapeHandler({
    id: 'dim-tool/cancel',
    priority: ESC_PRIORITY.DIM_TOOL,
    allowWhenEditable: true,
    canHandle: () => isDimTool(activeTool),
    handle: () => {
      const el = typeof document !== 'undefined' ? document.activeElement : null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.getAttribute('contenteditable') === 'true')) {
        (el as HTMLElement).blur?.();
      }
      wrappedOnKey('Escape');
      return true;
    },
  });

  const handlePoint = useCallback(
    (world: Point2D, hoveredEntity?: DetectableEntity) => {
      // ADR-362 hotfix (2026-05-19 round 2): use the click `world` directly,
      // not `state.cursorWorld`. The earlier hotfix substituted cursorWorld
      // for the dimLineRef click to dodge snap-mismatch between hover and
      // click time — that's now handled upstream by `isDimLineRefPhase()`
      // gating snap in `useDrawingHandlers` + `drawing-hover-handler`. The
      // substitution turned out to be HARMFUL: the reducer overwrites
      // `cursorWorld` with `action.world` on every click
      // (dimension-create-state.ts:301), so immediately after click#2 and
      // before any mousemove fires, `state.cursorWorld === click2_world`.
      // If click#3 lands without a mousemove first, commit position
      // collapses onto click#2 → dim line jumps onto the feature segment.
      // Enter-based commits keep using cursorWorld in `useDimensionCreate`
      // because there's no click event to source `world` from.
      dimCreate.onClick(world, hoveredEntity);

      // Skip preview re-push when this click flipped the store to
      // `commit-ready`. The commit runs in a microtask (queueMicrotask in
      // `useDimensionCreate`); a `pushPreview` here paints ONE frame of
      // green rubber-band that lingers next to the committed dim until the
      // microtask clears it — visible as a "double dim" flash. NOTE: this
      // sync clear is reinforced by the `commit-ready` guard inside
      // `buildPreviewDimensionEntity` (kills the RAF re-paint window).
      const postClick = dimensionCreateStore.get();
      if (postClick.status === 'commit-ready') {
        previewRef.current?.current?.clear();
      } else {
        pushPreview(previewRef);
      }
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
    onToolChangeRef.current?.('select');
    handleToolCompletion(activeTool, true);
  }, [dimCreate, activeTool]);

  return {
    isDimTool: isDimTool(activeTool),
    handlePoint,
    handleHover,
    handleCancel,
    handleKey: wrappedOnKey,
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
