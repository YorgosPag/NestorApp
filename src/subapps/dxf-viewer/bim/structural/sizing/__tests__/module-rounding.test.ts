/**
 * module-rounding SSoT (ADR-459 v16) — tolerant-ceil + floor σε module βήμα.
 */

import { roundUpToModule, roundDownToModule, MODULE_CEIL_EPSILON } from '../module-rounding';

describe('roundUpToModule', () => {
  it('rounds a plain value up to the module', () => {
    expect(roundUpToModule(201, 50)).toBe(250);
    expect(roundUpToModule(175, 10)).toBe(180);
  });

  it('keeps an exact multiple unchanged', () => {
    expect(roundUpToModule(200, 50)).toBe(200);
    expect(roundUpToModule(1300, 50)).toBe(1300);
  });

  it('tolerant-ceil: sub-ULP float dust ΔΕΝ πηδά ολόκληρο module', () => {
    // Η ρίζα του #3: rotation un-rotate dust.
    expect(roundUpToModule(1300.0000000000146, 50)).toBe(1300);
    expect(roundUpToModule(1000.0000000000146, 50)).toBe(1000);
  });

  it('ΠΡΑΓΜΑΤΙΚΗ τιμή ελάχιστα πάνω από module ΑΝΕΒΑΙΝΕΙ (όχι false-snap)', () => {
    expect(roundUpToModule(1300.5, 50)).toBe(1350);
    expect(roundUpToModule(200.5, 50)).toBe(250);
  });

  it('το epsilon είναι σχετικό (πηλίκο), μικρότερο από κάθε πραγματική ανάγκη', () => {
    expect(MODULE_CEIL_EPSILON).toBeLessThan(1e-6);
  });
});

describe('roundDownToModule', () => {
  it('rounds a plain value down to the module', () => {
    expect(roundDownToModule(249, 50)).toBe(200);
    expect(roundDownToModule(189, 10)).toBe(180);
  });

  it('keeps an exact multiple unchanged', () => {
    expect(roundDownToModule(200, 50)).toBe(200);
  });
});
