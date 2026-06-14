'use client';

// ============================================================================
// ✂️ SectionSliderShell — ADR-455 shared appearance SSoT for the cut sliders
// ============================================================================
//
// ONE presentational shell for ALL on-canvas cut sliders — the horizontal cut
// (ADR-452, `CutPlaneSliderControl`) AND the vertical X/Y cuts (ADR-455,
// `AxisCutSliderControl`). Owns the SINGLE appearance code path: the ViewCube-accent
// theme (`.cut-plane-slider-accent` + `.cut-plane-slider` from globals.css — neutral
// grey-blue at rest, orange on hover), the toggle button states, the readout pill, the
// Radix slider, and the label. Callers supply ONLY data + the type-specific icon /
// optional extra control (e.g. the X/Y flip arrow). No hardcoded colours — every hue
// comes from the shared CSS tokens, so all sliders stay visually identical.
// ============================================================================

import React from 'react';
import { Slider } from '@/components/ui/slider';
// ADR-366 — clear the SSoT crosshair on enter so it doesn't freeze under the overlay.
import { setImmediatePosition } from '../../systems/cursor/ImmediatePositionStore';

export interface SectionSliderShellProps {
  readonly orientation: 'horizontal' | 'vertical';
  readonly active: boolean;
  readonly onToggle: () => void;
  readonly toggleAriaLabel: string;
  readonly icon: React.ReactNode;
  /** Formatted readout (e.g. "2.50m"). */
  readonly readout: string;
  readonly label: string;
  /**
   * Compact mode (ADR-455 X/Y cuts): omit the Radix slider and render only the
   * toggle + extra control + readout + label as a small fixed corner widget. The cut
   * position is driven by the on-canvas handle (`axis-cut-grip`), not a normalized track,
   * so the slider props below are unused. The horizontal cut (ADR-452) keeps the slider.
   */
  readonly compact?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly value?: number;
  readonly ariaSlider?: string;
  readonly onValueChange?: (value: number) => void;
  /** Absolute placement + stacking classes supplied by the mounting leaf. */
  readonly positionClassName?: string;
  /** Optional extra control (e.g. the X/Y flip-arrow button), placed after the toggle. */
  readonly extraControl?: React.ReactNode;
}

export const SectionSliderShell = React.memo(function SectionSliderShell({
  orientation,
  active,
  onToggle,
  toggleAriaLabel,
  icon,
  readout,
  label,
  compact = false,
  min,
  max,
  step,
  value,
  ariaSlider,
  onValueChange,
  positionClassName = '',
  extraControl,
}: SectionSliderShellProps) {
  const horizontal = orientation === 'horizontal';
  return (
    <aside
      onMouseEnter={() => setImmediatePosition(null)}
      className={`cut-plane-slider-accent pointer-events-auto absolute flex cursor-default items-center gap-2 ${
        horizontal ? 'flex-row' : 'flex-col'
      } ${positionClassName}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={toggleAriaLabel}
        aria-pressed={active}
        // Like the ViewCube faces: the active (orange) state rests at ~60% and lifts to
        // full opacity on hover. The inactive state keeps its own neutral hover.
        className={`flex cursor-pointer select-none items-center justify-center rounded border p-1.5 shadow-md backdrop-blur-sm transition-all ${
          active
            ? 'border-primary bg-primary text-primary-foreground opacity-60 hover:opacity-100'
            : 'border-border bg-background/80 text-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
      >
        {icon}
      </button>
      {extraControl}
      <output className="rounded bg-background/80 px-1 py-0.5 text-[10px] font-semibold tabular-nums text-foreground shadow-sm backdrop-blur-sm">
        {readout}
      </output>
      {!compact && value !== undefined && onValueChange && (
        <Slider
          orientation={orientation}
          aria-label={ariaSlider}
          // `cut-plane-slider` themes the track/range/thumb like the ViewCube compass ring
          // (neutral at rest, orange accent on hover — see globals.css). Shared by all cuts.
          className={`cut-plane-slider flex-1 cursor-pointer [&_[role=slider]]:cursor-grab [&_[role=slider]]:active:cursor-grabbing ${
            horizontal ? 'mx-1' : 'my-1'
          }`}
          min={min}
          max={max}
          step={step}
          value={[value]}
          onValueChange={(v) => onValueChange(v[0])}
        />
      )}
      <span className="select-none text-[9px] font-medium text-muted-foreground" aria-hidden="true">
        {label}
      </span>
    </aside>
  );
});
