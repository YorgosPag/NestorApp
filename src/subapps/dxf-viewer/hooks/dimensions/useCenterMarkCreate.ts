'use client';

/**
 * ADR-362 Phase L2 — Standalone center mark + centerline creation tool.
 *
 * Two modes driven by the active `ToolType`:
 *   - `dim-center-mark`: single click places a `CenterMarkEntity` at the
 *     clicked world point. Size + style resolved from the active DIMSTYLE.
 *   - `dim-centerline`: two clicks define a `CenterLineEntity` (twoPoint kind).
 *
 * The hook is a thin state machine (useRef — no React re-renders, ADR-040
 * micro-leaf compliant). Preview for centerline (first click pending) is
 * pushed to the `PreviewCanvas` on every hover move.
 *
 * Associativity (D11) — click-time `geometryId` capture is deferred to Phase J.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-362-enterprise-dimension-system.md §D13
 */

import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { CenterMarkEntity, CenterLineEntity } from '../../types/center-mark';
import type { Entity } from '../../types/entities';
import type { ToolType } from '../../ui/toolbar/types';
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas';
import { generateCenterMarkId, generateCenterLineId } from '@/services/enterprise-id-convenience';
import { getDimStyleRegistry } from '../../systems/dimensions/dim-style-registry';
import { DXF_DEFAULT_LAYER } from '../../config/layer-config';
import { getLayer } from '../../stores/LayerStore';

// ── Constants ─────────────────────────────────────────────────────────────────

const CENTER_MARK_TOOLS: ReadonlySet<ToolType> = new Set([
  'dim-center-mark',
  'dim-centerline',
]);

// ── Public types ──────────────────────────────────────────────────────────────

export interface CenterMarkCreateAPI {
  /** Route a canvas click (world coordinates). */
  readonly handlePoint: (world: Point2D) => void;
  /** Route a hover move — updates centerline preview. */
  readonly handleHover: (world: Point2D | null) => void;
  /** Cancel / reset the current flow. */
  readonly handleCancel: () => void;
  /** Whether the active tool is handled by this hook. */
  readonly isCenterMarkTool: boolean;
}

export interface UseCenterMarkCreateParams {
  readonly activeTool: ToolType;
  readonly onEntityCreated: (entity: Entity) => void;
  readonly previewCanvasRef?: React.RefObject<PreviewCanvasHandle>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCenterMarkCreate(params: UseCenterMarkCreateParams): CenterMarkCreateAPI {
  const { activeTool, onEntityCreated, previewCanvasRef } = params;

  const onEntityCreatedRef = useRef(onEntityCreated);
  onEntityCreatedRef.current = onEntityCreated;

  const previewRef = useRef(previewCanvasRef);
  previewRef.current = previewCanvasRef;

  /** First picked point for the centerline 2-click flow. */
  const firstPointRef = useRef<Point2D | null>(null);

  // Reset flow when tool changes.
  // Only clear preview canvas when entering a center-mark mode — other tools
  // own their preview lifecycle and must NOT have it cleared on tool switch.
  useEffect(() => {
    firstPointRef.current = null;
    if (CENTER_MARK_TOOLS.has(activeTool)) {
      previewRef.current?.current?.clear();
    }
  }, [activeTool]);

  const handlePoint = useCallback((world: Point2D) => {
    if (activeTool === 'dim-center-mark') {
      const entity = buildCenterMarkEntity(world);
      onEntityCreatedRef.current(entity);
      return;
    }

    if (activeTool === 'dim-centerline') {
      if (!firstPointRef.current) {
        firstPointRef.current = world;
        return;
      }
      const entity = buildCenterLineEntity(firstPointRef.current, world);
      firstPointRef.current = null;
      previewRef.current?.current?.clear();
      onEntityCreatedRef.current(entity);
    }
  }, [activeTool]);

  const handleHover = useCallback((_world: Point2D | null) => {
    // Preview for centerline (rubber-band line) deferred to Phase L2+.
    // The PreviewCanvas infrastructure is available when Phase L2+ ships.
  }, []);

  const handleCancel = useCallback(() => {
    firstPointRef.current = null;
    previewRef.current?.current?.clear();
  }, []);

  return {
    handlePoint,
    handleHover,
    handleCancel,
    isCenterMarkTool: CENTER_MARK_TOOLS.has(activeTool),
  };
}

// ── Entity factories ──────────────────────────────────────────────────────────

function resolveLayerId(): string {
  return getLayer(DXF_DEFAULT_LAYER)?.id ?? '0';
}

function resolveDimcen(): number {
  return getDimStyleRegistry().getActiveStyle().dimcen;
}

function buildCenterMarkEntity(center: Point2D): CenterMarkEntity {
  const dimcen = resolveDimcen();
  const style = dimcen < 0 ? 'markWithLines' as const
    : dimcen > 0 ? 'markOnly' as const
    : 'none' as const;
  return {
    id: generateCenterMarkId(),
    type: 'center-mark',
    center,
    size: Math.abs(dimcen),
    style,
    layerId: resolveLayerId(),
  };
}

function buildCenterLineEntity(start: Point2D, end: Point2D): CenterLineEntity {
  return {
    id: generateCenterLineId(),
    type: 'centerline',
    kind: 'twoPoint',
    start,
    end,
    layerId: resolveLayerId(),
  };
}
