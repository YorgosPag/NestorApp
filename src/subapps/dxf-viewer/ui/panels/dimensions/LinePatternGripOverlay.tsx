'use client';

/**
 * LinePatternGripOverlay — ADR-642 Φ6-A (§6.7). The 8-handle bounding box that overlays the compound
 * pattern preview swatch: dragging the top/bottom mid-handles scales the band spread, left/right the
 * pattern length, corners both (Shift = aspect-lock). Direct manipulation of the authored `layers[]`
 * (`onLayersChange`) → editor state; the type commits only on Save (Cancel = nothing) — §6.7.3.
 *
 * FULL SSoT: the scale math is the pure `scaleLayerSpread`/`scalePatternLength` model helpers; the
 * layout/hit-direction/factor math is the pure `line-pattern-grip-geometry` module. This file is only
 * the SVG + pointer-capture shell — it mirrors `bim-3d/animation/BezierCurveEditor.tsx`, the codebase's
 * established "small SVG editor with draggable handles" pattern (setPointerCapture, `role="slider"`).
 * Editor preview, not the main canvas → outside ADR-040 (no cache-key / hover / useSyncExternalStore).
 */

import React from 'react';
import {
  type LinePatternLayer,
  bandHalfExtentMm,
  patternTotalLengthMm,
  scaleLayerSpread,
  scalePatternLength,
  LINE_PATTERN_MIN_MM,
} from '../../../config/line-pattern-segments';
import {
  type HandleAxis,
  type HandleId,
  type HandleLayout,
  handleAxis,
  layoutHandles,
  outwardDeltaPx,
  computeDragFactor,
} from './line-pattern-grip-geometry';
import {
  GRIP_COLD_COLOR,
  GRIP_WARM_COLOR,
  GRIP_HOT_COLOR,
  GRIP_CONTOUR_COLOR,
} from '../../../config/color-config';

/** i18n aria strings for the grips (no visible text — direct manipulation). */
export interface LinePatternGripLabels {
  readonly title: string;
  readonly spread: string;
  readonly length: string;
  readonly corner: string;
}

interface LinePatternGripOverlayProps {
  readonly layers: readonly LinePatternLayer[];
  readonly onLayersChange: (layers: LinePatternLayer[]) => void;
  readonly labels: LinePatternGripLabels;
}

const HANDLE_INSET_PX = 6;
const HANDLE_SIZE_PX = 8;
const SNAP_STEP_MM = 0.5;

/** Live drag snapshot — the target is always recomputed from the drag-start layers (reversible, stable). */
interface DragContext {
  readonly id: HandleId;
  readonly startX: number;
  readonly startY: number;
  readonly rectW: number;
  readonly rectH: number;
  readonly startLayers: LinePatternLayer[];
  readonly baseHalfMm: number;
  readonly baseLenMm: number;
}

// ── Pure drag → layers orchestration (composes the model + geometry SSoTs) ──

/** Shift on a corner locks aspect: the dominant axis' factor (largest deviation from 1) drives both. */
function aspectLocked(vFactor: number, hFactor: number): readonly [number, number] {
  const f = Math.abs(vFactor - 1) >= Math.abs(hFactor - 1) ? vFactor : hFactor;
  return [f, f];
}

/** Apply a pointer drag to the drag-start layers → new layers (Alt = free, Shift = aspect-lock on corners). */
function applyGripDrag(
  ctx: DragContext, dxPx: number, dyPx: number, free: boolean, aspectLock: boolean,
): LinePatternLayer[] {
  const axis = handleAxis(ctx.id);
  const { vertical, horizontal } = outwardDeltaPx(ctx.id, dxPx, dyPx);
  const common = { stepMm: SNAP_STEP_MM, minMm: LINE_PATTERN_MIN_MM, free };
  const vRaw = computeDragFactor({ axisHalfPx: ctx.rectH / 2, outwardPx: vertical, baseMm: ctx.baseHalfMm, ...common });
  const hRaw = computeDragFactor({ axisHalfPx: ctx.rectW / 2, outwardPx: horizontal, baseMm: ctx.baseLenMm, ...common });
  const [vf, hf] = aspectLock && axis === 'both' ? aspectLocked(vRaw, hRaw) : [vRaw, hRaw];
  let next = ctx.startLayers;
  if (axis !== 'horizontal') next = scaleLayerSpread(next, vf);
  if (axis !== 'vertical') next = scalePatternLength(next, hf);
  return next;
}

/** Keyboard nudge — one 0.5 mm snap step per Arrow press (spread on ↑/↓, length on ←/→). */
function applyKeyboardNudge(
  id: HandleId, layers: readonly LinePatternLayer[], stepsX: number, stepsY: number,
): LinePatternLayer[] {
  const axis = handleAxis(id);
  let next: LinePatternLayer[] = layers.map((l) => ({ ...l }));
  if (axis !== 'horizontal' && stepsY !== 0) {
    const base = bandHalfExtentMm(next);
    if (base > 0) next = scaleLayerSpread(next, (base + stepsY * SNAP_STEP_MM) / base);
  }
  if (axis !== 'vertical' && stepsX !== 0) {
    const base = patternTotalLengthMm(next[0]?.segments ?? []);
    if (base > 0) next = scalePatternLength(next, (base + stepsX * SNAP_STEP_MM) / base);
  }
  return next;
}

const CURSOR_BY_ID: Readonly<Record<HandleId, string>> = {
  tl: 'nwse-resize', br: 'nwse-resize', tr: 'nesw-resize', bl: 'nesw-resize',
  tm: 'ns-resize', bm: 'ns-resize', ml: 'ew-resize', mr: 'ew-resize',
};

function ariaForAxis(axis: HandleAxis, labels: LinePatternGripLabels): string {
  return axis === 'vertical' ? labels.spread : axis === 'horizontal' ? labels.length : labels.corner;
}

// ── Component ──

export function LinePatternGripOverlay({ layers, onLayersChange, labels }: LinePatternGripOverlayProps) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const dragRef = React.useRef<DragContext | null>(null);
  const [box, setBox] = React.useState<{ w: number; h: number } | null>(null);
  // Which handle is being dragged — drives the «hot» (red) grip colour (grip-identity SSoT parity).
  const [activeId, setActiveId] = React.useState<HandleId | null>(null);

  React.useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handlePointerDown = (id: HandleId) => (e: React.PointerEvent<SVGRectElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const svg = svgRef.current;
    const r = svg?.getBoundingClientRect();
    if (!svg || !r) return;
    svg.setPointerCapture(e.pointerId);
    setActiveId(id);
    dragRef.current = {
      id, startX: e.clientX, startY: e.clientY, rectW: r.width, rectH: r.height,
      startLayers: layers.map((l) => ({ ...l })),
      baseHalfMm: bandHalfExtentMm(layers),
      baseLenMm: patternTotalLengthMm(layers[0]?.segments ?? []),
    };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const ctx = dragRef.current;
    if (!ctx) return;
    onLayersChange(applyGripDrag(ctx, e.clientX - ctx.startX, e.clientY - ctx.startY, e.altKey, e.shiftKey));
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current = null;
    setActiveId(null);
    if (svgRef.current?.hasPointerCapture(e.pointerId)) svgRef.current.releasePointerCapture(e.pointerId);
  };

  const handles = box ? layoutHandles({ width: box.w, height: box.h, inset: HANDLE_INSET_PX }) : [];

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 h-full w-full touch-none"
      viewBox={box ? `0 0 ${box.w} ${box.h}` : undefined}
      preserveAspectRatio="none"
      role="group"
      aria-label={labels.title}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {box && (
        <rect
          x={HANDLE_INSET_PX}
          y={HANDLE_INSET_PX}
          width={Math.max(0, box.w - HANDLE_INSET_PX * 2)}
          height={Math.max(0, box.h - HANDLE_INSET_PX * 2)}
          fill="none"
          stroke={GRIP_COLD_COLOR}
          strokeOpacity={0.55}
          strokeDasharray="3 2"
          aria-hidden
        />
      )}
      {handles.map((h) => (
        <GripHandle
          key={h.id}
          handle={h}
          label={ariaForAxis(h.axis, labels)}
          active={activeId === h.id}
          onPointerDown={handlePointerDown(h.id)}
          onNudge={(sx, sy) => onLayersChange(applyKeyboardNudge(h.id, layers, sx, sy))}
        />
      ))}
    </svg>
  );
}

// ── Subcomponents ──

function GripHandle({
  handle, label, active, onPointerDown, onNudge,
}: {
  handle: HandleLayout;
  label: string;
  active: boolean;
  onPointerDown: (e: React.PointerEvent<SVGRectElement>) => void;
  onNudge: (stepsX: number, stepsY: number) => void;
}) {
  const [hover, setHover] = React.useState(false);
  const onKeyDown = (e: React.KeyboardEvent<SVGRectElement>) => {
    const map: Record<string, [number, number]> = {
      ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1],
    };
    const step = map[e.key];
    if (!step) return;
    e.preventDefault();
    onNudge(step[0], step[1]);
  };
  // Grip-identity SSoT (config/color-config): cold (azure) → warm (magenta hover) → hot (red drag),
  // black contour so the square reads on any swatch background / theme.
  const fill = active ? GRIP_HOT_COLOR : hover ? GRIP_WARM_COLOR : GRIP_COLD_COLOR;
  return (
    <rect
      x={handle.x - HANDLE_SIZE_PX / 2}
      y={handle.y - HANDLE_SIZE_PX / 2}
      width={HANDLE_SIZE_PX}
      height={HANDLE_SIZE_PX}
      rx={1}
      fill={fill}
      stroke={GRIP_CONTOUR_COLOR}
      strokeWidth={1}
      tabIndex={0}
      role="slider"
      aria-label={label}
      style={{ cursor: CURSOR_BY_ID[handle.id] }}
      onPointerDown={onPointerDown}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onKeyDown={onKeyDown}
      className="focus:outline-none"
    />
  );
}
