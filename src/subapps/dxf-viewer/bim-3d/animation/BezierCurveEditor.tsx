'use client';

/**
 * ADR-366 §C.1.Q4 — Bezier curve editor (Chrome-DevTools-style).
 *
 * Controlled component για 4-point cubic bezier editing. P0=(0,0) και P3=(1,1)
 * fixed, P1+P2 draggable. Παρέχει:
 *  - SVG canvas με curve preview + 2 draggable handles
 *  - 4 numeric inputs (P1x, P1y, P2x, P2y) — instant patch
 *  - Preset gallery (8 chips clickable) — quick swap σε CSS-standard curves
 *  - Reset button — επιστρέφει σε preset (clears customBezier)
 *  - Live preview ball — animated dot @ 2s loop, RAF-driven, mounts on demand
 *  - Keyboard a11y: focusable handles, Arrow nudge ±0.01, Shift+Arrow ±0.1
 *
 * Mirror του ribbon panel palette (bg-black/30, white text, tailwind tokens).
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clamp } from '../../utils/scalar-math';
import {
  BEZIER_RANGES,
  EASING_PRESET_IDS,
  type BezierControlPoints,
  type EasingPresetId,
} from './animation-types';
import { cubicBezier } from '../viewport/bezier-easing';
import { getPresetBezier } from './presets/preset-bezier-defaults';

const CANVAS_SIZE = 220;
const PADDING = 16;
const PLOT = CANVAS_SIZE - PADDING * 2; // 188px usable plot area

interface Props {
  readonly value: BezierControlPoints;
  readonly presetId: EasingPresetId;
  readonly onChange: (next: BezierControlPoints) => void;
  readonly onReset: () => void;
  readonly isCustomActive: boolean;
}

type HandleId = 'p1' | 'p2';

export function BezierCurveEditor({ value, presetId, onChange, onReset, isCustomActive }: Props) {
  const { t } = useTranslation('bim3d');
  return (
    <section
      aria-label={t('animation.easing.bezier.title')}
      className="flex flex-col gap-2 rounded border border-white/10 bg-black/40 p-2"
    >
      <header className="flex items-center justify-between">
        <h5 className="text-[10px] font-semibold uppercase tracking-wide text-white/60">
          {t('animation.easing.bezier.title')}
        </h5>
        <button
          type="button"
          onClick={onReset}
          disabled={!isCustomActive}
          className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white hover:bg-white/20 disabled:opacity-40 disabled:hover:bg-white/10"
        >
          {t('animation.easing.bezier.reset')}
        </button>
      </header>

      <CurveSvg value={value} onChange={onChange} t={t} />

      <NumericInputs value={value} onChange={onChange} t={t} />

      <PresetGallery activePresetId={presetId} onPick={(id) => onChange(getPresetBezier(id))} t={t} />
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SVG canvas — curve + draggable handles + live preview ball
// ──────────────────────────────────────────────────────────────────────────────

interface CurveSvgProps {
  readonly value: BezierControlPoints;
  readonly onChange: (next: BezierControlPoints) => void;
  readonly t: (key: string) => string;
}

function CurveSvg({ value, onChange, t }: CurveSvgProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragHandleRef = useRef<HandleId | null>(null);
  const titleId = useId();

  const curvePath = useMemo(() => buildCurvePath(value), [value]);

  const handlePointerDown = useCallback(
    (handle: HandleId) => (e: React.PointerEvent<SVGCircleElement>) => {
      e.preventDefault();
      dragHandleRef.current = handle;
      (e.target as Element).setPointerCapture(e.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const handle = dragHandleRef.current;
      if (!handle || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const xNorm = clamp((e.clientX - rect.left - PADDING) / PLOT, BEZIER_RANGES.xMin, BEZIER_RANGES.xMax);
      const yNorm = clamp(
        1 - (e.clientY - rect.top - PADDING) / PLOT,
        BEZIER_RANGES.yMin,
        BEZIER_RANGES.yMax,
      );
      onChange(
        handle === 'p1'
          ? { p1: [round2(xNorm), round2(yNorm)], p2: value.p2 }
          : { p1: value.p1, p2: [round2(xNorm), round2(yNorm)] },
      );
    },
    [onChange, value.p1, value.p2],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    dragHandleRef.current = null;
    if (svgRef.current && svgRef.current.hasPointerCapture(e.pointerId)) {
      svgRef.current.releasePointerCapture(e.pointerId);
    }
  }, []);

  return (
    <svg
      ref={svgRef}
      width={CANVAS_SIZE}
      height={CANVAS_SIZE}
      viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
      role="img"
      aria-labelledby={titleId}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="rounded bg-black/40"
    >
      <title id={titleId}>{t('animation.easing.bezier.title')}</title>

      <GridAndAxes />

      <HandleGuide from={[PADDING, PADDING + PLOT]} to={normToSvg(value.p1)} />
      <HandleGuide from={[PADDING + PLOT, PADDING]} to={normToSvg(value.p2)} />

      <path d={curvePath} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} />

      <PreviewBall value={value} />

      <Handle
        id="p1"
        position={normToSvg(value.p1)}
        label={t('animation.easing.bezier.handleP1')}
        value={value.p1}
        onPointerDown={handlePointerDown('p1')}
        onKeyboard={(dx, dy) =>
          onChange({ p1: nudge(value.p1, dx, dy), p2: value.p2 })
        }
      />
      <Handle
        id="p2"
        position={normToSvg(value.p2)}
        label={t('animation.easing.bezier.handleP2')}
        value={value.p2}
        onPointerDown={handlePointerDown('p2')}
        onKeyboard={(dx, dy) =>
          onChange({ p1: value.p1, p2: nudge(value.p2, dx, dy) })
        }
      />
    </svg>
  );
}

function GridAndAxes() {
  return (
    <g aria-hidden>
      <rect
        x={PADDING}
        y={PADDING}
        width={PLOT}
        height={PLOT}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={1}
      />
      {[0.25, 0.5, 0.75].map((g) => (
        <g key={g}>
          <line
            x1={PADDING + g * PLOT}
            x2={PADDING + g * PLOT}
            y1={PADDING}
            y2={PADDING + PLOT}
            stroke="rgba(255,255,255,0.05)"
          />
          <line
            x1={PADDING}
            x2={PADDING + PLOT}
            y1={PADDING + g * PLOT}
            y2={PADDING + g * PLOT}
            stroke="rgba(255,255,255,0.05)"
          />
        </g>
      ))}
    </g>
  );
}

function HandleGuide({ from, to }: { readonly from: readonly [number, number]; readonly to: readonly [number, number] }) {
  return (
    <line
      x1={from[0]}
      y1={from[1]}
      x2={to[0]}
      y2={to[1]}
      stroke="rgba(255,255,255,0.25)"
      strokeDasharray="3 2"
    />
  );
}

interface HandleProps {
  readonly id: HandleId;
  readonly position: readonly [number, number];
  readonly label: string;
  readonly value: readonly [number, number];
  readonly onPointerDown: (e: React.PointerEvent<SVGCircleElement>) => void;
  readonly onKeyboard: (dx: number, dy: number) => void;
}

function Handle({ id, position, label, value, onPointerDown, onKeyboard }: HandleProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<SVGCircleElement>) => {
      const step = e.shiftKey ? BEZIER_RANGES.stepCoarse : BEZIER_RANGES.step;
      if (e.key === 'ArrowRight') { onKeyboard(step, 0); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { onKeyboard(-step, 0); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { onKeyboard(0, step); e.preventDefault(); }
      else if (e.key === 'ArrowDown') { onKeyboard(0, -step); e.preventDefault(); }
    },
    [onKeyboard],
  );

  return (
    <circle
      cx={position[0]}
      cy={position[1]}
      r={6}
      fill="hsl(var(--primary))"
      stroke="white"
      strokeWidth={1.5}
      tabIndex={0}
      role="slider"
      aria-label={label}
      aria-valuetext={`${id} X=${value[0].toFixed(2)} Y=${value[1].toFixed(2)}`}
      onPointerDown={onPointerDown}
      onKeyDown={handleKeyDown}
      className="cursor-grab focus:outline-none focus:ring-2 focus:ring-white/60"
    />
  );
}

function PreviewBall({ value }: { readonly value: BezierControlPoints }) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = (now - startRef.current) / 2000; // 2s loop
      setProgress(elapsed - Math.floor(elapsed));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      startRef.current = null;
    };
  }, []);

  const easing = useMemo(
    () => cubicBezier(value.p1[0], value.p1[1], value.p2[0], value.p2[1]),
    [value.p1, value.p2],
  );

  const easedY = easing(progress);
  const cx = PADDING + progress * PLOT;
  const cy = PADDING + (1 - easedY) * PLOT;

  return <circle cx={cx} cy={cy} r={4} fill="hsl(var(--text-warning))" aria-hidden />;
}

// ──────────────────────────────────────────────────────────────────────────────
// Numeric inputs (4 fields)
// ──────────────────────────────────────────────────────────────────────────────

interface NumericInputsProps {
  readonly value: BezierControlPoints;
  readonly onChange: (next: BezierControlPoints) => void;
  readonly t: (key: string) => string;
}

function NumericInputs({ value, onChange, t }: NumericInputsProps) {
  return (
    <div className="grid grid-cols-2 gap-1">
      <NumberField
        label={t('animation.easing.bezier.p1x')}
        value={value.p1[0]}
        min={BEZIER_RANGES.xMin}
        max={BEZIER_RANGES.xMax}
        onChange={(v) => onChange({ p1: [v, value.p1[1]], p2: value.p2 })}
      />
      <NumberField
        label={t('animation.easing.bezier.p1y')}
        value={value.p1[1]}
        min={BEZIER_RANGES.yMin}
        max={BEZIER_RANGES.yMax}
        onChange={(v) => onChange({ p1: [value.p1[0], v], p2: value.p2 })}
      />
      <NumberField
        label={t('animation.easing.bezier.p2x')}
        value={value.p2[0]}
        min={BEZIER_RANGES.xMin}
        max={BEZIER_RANGES.xMax}
        onChange={(v) => onChange({ p1: value.p1, p2: [v, value.p2[1]] })}
      />
      <NumberField
        label={t('animation.easing.bezier.p2y')}
        value={value.p2[1]}
        min={BEZIER_RANGES.yMin}
        max={BEZIER_RANGES.yMax}
        onChange={(v) => onChange({ p1: value.p1, p2: [value.p2[0], v] })}
      />
    </div>
  );
}

interface NumberFieldProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onChange: (v: number) => void;
}

function NumberField({ label, value, min, max, onChange }: NumberFieldProps) {
  return (
    <label className="flex items-center gap-1">
      <span className="w-10 text-[10px] uppercase tracking-wide text-white/50">{label}</span>
      <input
        type="number"
        step={BEZIER_RANGES.step}
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(clamp(Number(e.target.value), min, max))}
        className="flex-1 rounded bg-black/30 px-1 py-0.5 text-[11px] text-white"
      />
    </label>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Preset gallery (8 chips)
// ──────────────────────────────────────────────────────────────────────────────

interface PresetGalleryProps {
  readonly activePresetId: EasingPresetId;
  readonly onPick: (id: EasingPresetId) => void;
  readonly t: (key: string) => string;
}

function PresetGallery({ activePresetId, onPick, t }: PresetGalleryProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-white/50">
        {t('animation.easing.bezier.presets')}
      </span>
      <div className="grid grid-cols-4 gap-1">
        {EASING_PRESET_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onPick(id)}
            aria-pressed={id === activePresetId}
            className={[
              'rounded px-1 py-0.5 text-[9px] font-medium text-white',
              id === activePresetId
                ? 'bg-primary/60'
                : 'bg-white/10 hover:bg-white/20',
            ].join(' ')}
          >
            {t(`animation.easing.${easingI18nKey(id)}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ──────────────────────────────────────────────────────────────────────────────


function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function normToSvg([x, y]: readonly [number, number]): readonly [number, number] {
  return [PADDING + x * PLOT, PADDING + (1 - y) * PLOT];
}

function nudge(point: readonly [number, number], dx: number, dy: number): readonly [number, number] {
  return [
    round2(clamp(point[0] + dx, BEZIER_RANGES.xMin, BEZIER_RANGES.xMax)),
    round2(clamp(point[1] + dy, BEZIER_RANGES.yMin, BEZIER_RANGES.yMax)),
  ];
}

function buildCurvePath(value: BezierControlPoints): string {
  const [x0, y0] = normToSvg([0, 0]);
  const [x1, y1] = normToSvg(value.p1);
  const [x2, y2] = normToSvg(value.p2);
  const [x3, y3] = normToSvg([1, 1]);
  return `M ${x0} ${y0} C ${x1} ${y1}, ${x2} ${y2}, ${x3} ${y3}`;
}

function easingI18nKey(id: EasingPresetId): string {
  return id
    .split('-')
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}
