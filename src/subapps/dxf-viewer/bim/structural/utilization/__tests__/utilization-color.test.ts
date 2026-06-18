/**
 * ADR-485 (T3-UI / Slice 4c) — utilization colour-ramp unit tests.
 *
 * Κλειδώνει τα διακριτά κατώφλια επάρκειας (Robot stress map): πράσινο ≤0.85,
 * πορτοκαλί 0.85–1.0, κόκκινο >1.0 — boundary-exact (ο μηχανικός βασίζεται στο
 * pass/marginal/fail, όχι σε gradient).
 */

import {
  utilizationBand,
  utilizationFillColor,
  utilizationLegendColor,
  UTILIZATION_OK_MAX,
  UTILIZATION_WARN_MAX,
} from '../utilization-color';

describe('utilizationBand — διακριτά κατώφλια', () => {
  it('αφόρτιστο / χαμηλό ⇒ ok (πράσινο)', () => {
    expect(utilizationBand(0)).toBe('ok');
    expect(utilizationBand(0.5)).toBe('ok');
  });

  it('ακριβώς στο 0.85 ⇒ ok (κλειστό άνω όριο)', () => {
    expect(utilizationBand(UTILIZATION_OK_MAX)).toBe('ok');
  });

  it('μεταξύ 0.85 και 1.0 ⇒ warn (πορτοκαλί)', () => {
    expect(utilizationBand(0.86)).toBe('warn');
    expect(utilizationBand(UTILIZATION_WARN_MAX)).toBe('warn');
  });

  it('πάνω από 1.0 ⇒ over (κόκκινο)', () => {
    expect(utilizationBand(1.0001)).toBe('over');
    expect(utilizationBand(3)).toBe('over');
  });
});

describe('utilizationFillColor / utilizationLegendColor', () => {
  it('επιστρέφει διαφορετικό χρώμα ανά βαθμίδα', () => {
    const colors = new Set([
      utilizationFillColor(0.4),
      utilizationFillColor(0.9),
      utilizationFillColor(1.5),
    ]);
    expect(colors.size).toBe(3);
  });

  it('legend χρώμα είναι solid (rgb, όχι rgba) ανά βαθμίδα', () => {
    expect(utilizationLegendColor('ok')).toMatch(/^rgb\(/);
    expect(utilizationLegendColor('warn')).toMatch(/^rgb\(/);
    expect(utilizationLegendColor('over')).toMatch(/^rgb\(/);
  });
});
