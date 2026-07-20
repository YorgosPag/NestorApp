/**
 * ADR-366 §C.1.b — TimelineScrubber anchors.
 *
 * ΤΙ ΦΥΛΑΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ (και γιατί κάθε anchor έχει αντικείμενο):
 *
 *  1. DEGENERATE ΔΙΑΡΚΕΙΑ. `durationSec <= 0` (ή NaN/Infinity) είναι ο μόνος
 *     δρόμος προς διαίρεση με το μηδέν στο tick mapping. Το πλήθος των ticks
 *     είναι ο ΜΕΤΡΗΣΙΜΟΣ μάρτυρας ότι ο guard κρατάει: μηδέν ticks, καμία NaN
 *     θέση. Χωρίς δίχτυ πλήθους ένα anchor «δεν έσκασε» περνά για πάντα.
 *  2. ΠΛΗΘΟΣ TICKS = ΠΛΗΘΟΣ WAYPOINTS. Κάθε waypoint γεννά ΕΝΑ tick, ακόμη κι
 *     όταν πέφτει εκτός ορίων (clamping ΔΕΝ σημαίνει απόρριψη).
 *  3. IN-BOUNDS MAPPING. Τα ticks οφείλουν να μιλούν την ίδια γλώσσα θέσης με
 *     τον Radix thumb — αλλιώς ξαναγυρίζει η ~10px απόκλιση στα άκρα.
 */

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { TimelineScrubber, tickLeftFromPercent } from '../TimelineScrubber';

afterEach(cleanup);

/** Τα ticks είναι το ΜΟΝΟ `aria-hidden` overlay μέσα στον scrubber. */
function countTicks(container: HTMLElement): number {
  const overlay = container.querySelector('[aria-hidden]');
  return overlay === null ? 0 : overlay.querySelectorAll('span').length;
}

function renderScrubber(durationSec: number, waypointSecs: readonly number[]) {
  return render(
    <TimelineScrubber
      valueSec={0}
      durationSec={durationSec}
      onChange={() => undefined}
      waypoints={waypointSecs.map((timeSec) => ({ timeSec }))}
      ariaLabel="scrubber"
    />
  );
}

describe('TimelineScrubber — degenerate duration', () => {
  it.each([0, -1, -0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'renders NO ticks and never divides by zero for durationSec=%p',
    (durationSec) => {
      const { container } = renderScrubber(durationSec, [0, 1, 2]);
      expect(countTicks(container)).toBe(0);
      expect(container.innerHTML).not.toContain('NaN');
    }
  );

  it('disables the slider when there is no duration', () => {
    const { container } = renderScrubber(0, []);
    expect(container.querySelector('[data-disabled]')).not.toBeNull();
  });
});

describe('TimelineScrubber — tick count', () => {
  it('renders exactly one tick per waypoint', () => {
    const { container } = renderScrubber(10, [0, 2.5, 5, 7.5, 10]);
    expect(countTicks(container)).toBe(5);
  });

  it('renders no ticks when there are no waypoints', () => {
    const { container } = renderScrubber(10, []);
    expect(countTicks(container)).toBe(0);
  });

  it('keeps out-of-range waypoints as ticks (clamped, not dropped)', () => {
    const { container } = renderScrubber(10, [-5, 3, 42]);
    expect(countTicks(container)).toBe(3);
  });
});

describe('tickLeftFromPercent — Radix in-bounds mapping', () => {
  // The offset is expressed as a FRACTION OF THE THUMB TOKEN, not a hardcoded
  // pixel count. That is the whole point (ADR-682): the ticks and the thumb now
  // read the same `--slider-thumb-size`, so a size change cannot desynchronise
  // them. A literal `10px` here would re-introduce the copy this fix removed.
  const TOKEN = 'var(--slider-thumb-size)';

  it('offsets by +half a thumb at 0% and -half at 100%', () => {
    expect(tickLeftFromPercent(0)).toBe(`calc(0% + (0.5 * ${TOKEN}))`);
    expect(tickLeftFromPercent(100)).toBe(`calc(100% + (-0.5 * ${TOKEN}))`);
  });

  it('applies no offset at the midpoint', () => {
    expect(tickLeftFromPercent(50)).toBe(`calc(50% + (0 * ${TOKEN}))`);
  });

  it('interpolates linearly between the bounds', () => {
    expect(tickLeftFromPercent(25)).toBe(`calc(25% + (0.25 * ${TOKEN}))`);
    expect(tickLeftFromPercent(75)).toBe(`calc(75% + (-0.25 * ${TOKEN}))`);
  });

  it('never emits a bare operator next to a sign (invalid calc syntax)', () => {
    // `calc(75% + -0.25 * var(…))` does not parse; the parentheses are required.
    for (const pct of [0, 12.5, 25, 50, 75, 99, 100]) {
      expect(tickLeftFromPercent(pct)).not.toMatch(/[+\-*/]\s*-\d/);
    }
  });
});
