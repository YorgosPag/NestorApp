'use client';

/**
 * ADR-366 §C.1.b — Timeline playhead scrubber (δηλωμένο SSoT).
 *
 * ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ COMPONENT (και ΟΧΙ SliderInput):
 * Στα NLE/3D πακέτα (Cinema 4D, After Effects, Premiere) ο playhead ενός
 * timeline ΔΕΝ είναι slider παραμέτρου. Είναι δικό του control με:
 *  - timecode readout αντί για αριθμητική τιμή,
 *  - keyframe/waypoint markers ζωγραφισμένα πάνω στο track,
 *  - χρονική (όχι γενικού σκοπού) σημασιολογία στο βήμα.
 * Το να περνούσε από το SliderInput (settings slider με label/unit/reset)
 * θα ήταν ΛΑΘΟΣ κεντρικοποίηση — ίδιο widget, διαφορετικό νόημα.
 *
 * Χτισμένο πάνω στο Radix `Slider` (@/components/ui/slider) ώστε να ΜΗΝ
 * είναι ωμό `<input type="range">`: κερδίζει keyboard/ARIA/pointer capture
 * συμπεριφορά και το ενιαίο look του design system.
 *
 * Micro-leaf (ADR-040): fully controlled, καμία store subscription εδώ.
 */

import { useCallback, useMemo } from 'react';
import { Slider } from '@/components/ui/slider';
import { formatTime } from './timeline-time-format';

/** Χρονική θέση ενός marker πάνω στο track. */
export interface TimelineScrubberMarker {
  readonly timeSec: number;
}

export interface TimelineScrubberProps {
  /** Τρέχουσα θέση playhead σε δευτερόλεπτα. */
  readonly valueSec: number;
  /** Συνολική διάρκεια. `<= 0` → ο scrubber απενεργοποιείται. */
  readonly durationSec: number;
  readonly onChange: (sec: number) => void;
  /** Waypoint ticks πάνω στο track. */
  readonly waypoints?: ReadonlyArray<TimelineScrubberMarker>;
  readonly ariaLabel: string;
  readonly disabled?: boolean;
}

/** Millisecond-grade scrub — ό,τι ανάλυση δείχνει και το timecode readout. */
const SCRUB_STEP_SEC = 0.001;

export function TimelineScrubber(props: TimelineScrubberProps) {
  const { valueSec, durationSec, onChange, waypoints, ariaLabel, disabled } = props;

  // Guard: μηδενική/άκυρη διάρκεια → ποτέ διαίρεση με το μηδέν, ποτέ
  // degenerate Radix range (min === max).
  const hasDuration = Number.isFinite(durationSec) && durationSec > 0;
  const maxSec = hasDuration ? durationSec : SCRUB_STEP_SEC;
  const clampedSec = Math.min(Math.max(valueSec, 0), maxSec);

  const sliderValue = useMemo(() => [clampedSec], [clampedSec]);

  const handleValueChange = useCallback(
    (next: number[]) => onChange(next[0] ?? 0),
    [onChange],
  );

  const markerPercents = useMemo(
    () => (hasDuration ? toMarkerPercents(waypoints, durationSec) : []),
    [hasDuration, waypoints, durationSec],
  );

  return (
    <section className="flex flex-col gap-1" aria-label={ariaLabel}>
      <output className="font-mono text-[10px] text-white/70">{formatTime(clampedSec)}</output>
      <div className="relative w-full">
        <Slider
          value={sliderValue}
          onValueChange={handleValueChange}
          min={0}
          max={maxSec}
          step={SCRUB_STEP_SEC}
          disabled={disabled === true || !hasDuration}
          aria-label={ariaLabel}
          className="w-full"
        />
        <TimelineScrubberTicks percents={markerPercents} />
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Waypoint ticks — decorative overlay πάνω από το track
// ──────────────────────────────────────────────────────────────────────────────

function TimelineScrubberTicks({ percents }: { readonly percents: readonly number[] }) {
  if (percents.length === 0) return null;
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 block">
      {percents.map((pct, i) => (
        <span
          key={i}
          // Η οριζόντια θέση είναι συνεχής συνάρτηση του χρόνου — αδύνατη ως
          // token. ΜΟΝΟ αυτή πάει inline· ό,τι άλλο είναι κλάση.
          style={{ left: `${pct}%` }}
          className="absolute top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-[hsl(var(--text-warning))]/80"
        />
      ))}
    </span>
  );
}

function toMarkerPercents(
  waypoints: ReadonlyArray<TimelineScrubberMarker> | undefined,
  durationSec: number,
): readonly number[] {
  if (waypoints === undefined || waypoints.length === 0) return [];
  return waypoints.map((w) => {
    const ratio = Number.isFinite(w.timeSec) ? w.timeSec / durationSec : 0;
    return Math.min(Math.max(ratio, 0), 1) * 100;
  });
}
