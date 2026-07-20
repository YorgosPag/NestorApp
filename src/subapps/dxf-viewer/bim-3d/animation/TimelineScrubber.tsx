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

/**
 * Το design token του μεγέθους thumb — δηλωμένο ΜΙΑ φορά στο `globals.css` και
 * καταναλωνόμενο ΚΑΙ από τον ίδιο τον thumb (`src/components/ui/slider.tsx`, μέσω
 * height/width arbitrary utilities πάνω στο ίδιο `--slider-thumb-size` token) ΚΑΙ
 * από εδώ. (Το utility ΔΕΝ γράφεται εδώ ολόκληρο: ο Tailwind scanner διαβάζει και
 * τα σχόλια, οπότε ένα literal bracket-utility θα παρήγαγε άκυρο CSS build error.)
 *
 * ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ ΕΔΩ: ο Radix κρατά το thumb ΕΝΤΟΣ ορίων του track — στο 0%
 * το κέντρο του κάθεται στο +½ πλάτος, στο 100% στο −½, γραμμικά ενδιάμεσα. Ένα
 * tick σε σκέτο `left: X%` κάθεται στο γεωμετρικό X% του container, οπότε στα
 * άκρα αποκλίνει ~10px (~3.5% σε panel w-72). Τα ticks πρέπει να μιλούν την
 * ΙΔΙΑ γλώσσα θέσης με το thumb.
 *
 * ΠΡΙΝ ήταν `THUMB_SIZE_PX = 20`, δηλαδή ΑΝΤΙΓΡΑΦΟ του `h-5 w-5` του primitive,
 * φυλαγμένο μόνο από σχόλιο «κράτα το συγχρονισμένο» — μια αλλαγή μεγέθους εκεί
 * θα ξεκόλλαγε τα ticks ΣΙΩΠΗΛΑ. Πλέον η αριθμητική γίνεται σε CSS `calc()`
 * πάνω στο ίδιο token, οπότε δεν υπάρχει δεύτερος αριθμός να ξεσυγχρονιστεί.
 */
const THUMB_SIZE_TOKEN = 'var(--slider-thumb-size)';

/**
 * Το in-bounds mapping του Radix, εκφρασμένο ως CSS `left`.
 *
 * Ο συντελεστής (0.5 − pct/100) ∈ [−0.5, +0.5] πολλαπλασιάζει το token μέσα σε
 * παρενθέσεις: `calc(50% + (-0.15 * var(--slider-thumb-size)))`.
 *
 * ΟΙ ΠΑΡΕΝΘΕΣΕΙΣ ΕΙΝΑΙ ΑΝΑΓΝΩΣΙΜΟΤΗΤΑ, ΟΧΙ ΕΓΚΥΡΟΤΗΤΑ. (Προηγούμενη έκδοση αυτού
 * του σχολίου ισχυριζόταν ότι το `calc(50% + -0.15 * var(…))` είναι άκυρο· ΔΕΝ
 * είναι — το `-0.15` είναι ΕΝΑ προσημασμένο number token, και μόνο οι τελεστές
 * `+`/`-` απαιτούν κενά γύρω τους, όχι το πρόσημο ενός αριθμού. Το test από κάτω
 * καρφώνει το ΣΧΗΜΑ που εκπέμπουμε, όχι κανόνα της CSS.)
 *
 * ΚΑΙ ΤΑ ΔΥΟ νούμερα περνούν από `roundNumber`: χωρίς αυτό, ένα waypoint με
 * ελάχιστο `timeSec / durationSec` δίνει `pct` σε **εκθετική σημειογραφία**
 * (`9.99e-8%`), που είναι **άκυρη CSS** — και το jsdom τη δέχεται αδιαμαρτύρητα,
 * άρα κανένα test δεν θα την έπιανε.
 */
export function tickLeftFromPercent(pct: number): string {
  const safePct = roundNumber(pct);
  const offsetRatio = roundNumber(0.5 - pct / 100);
  return `calc(${safePct}% + (${offsetRatio} * ${THUMB_SIZE_TOKEN}))`;
}

/** Κόβει τον θόρυβο κινητής υποδιαστολής ΚΑΙ την εκθετική σημειογραφία. */
function roundNumber(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * ΓΙΑΤΙ `thumbAriaLabel` ΚΑΙ ΟΧΙ `aria-label`: ο Radix βάζει `role="slider"` στο
 * THUMB — ένα `aria-label` στο Root θα προσγειωνόταν σε άρολο span και δεν θα
 * ανακοινωνόταν ποτέ. Έτσι ο scrubber ξαναποκτά το accessible name που είχε
 * όσο ήταν ωμό native range input.
 *
 * Το `hasDuration` φυλάει από μηδενική/άκυρη διάρκεια: ποτέ διαίρεση με το
 * μηδέν, ποτέ degenerate Radix range (`min === max`).
 */
export function TimelineScrubber(props: TimelineScrubberProps) {
  const { valueSec, durationSec, onChange, waypoints, ariaLabel, disabled } = props;

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
          thumbAriaLabel={ariaLabel}
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
          style={{ left: tickLeftFromPercent(pct) }}
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
