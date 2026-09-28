/**
 * ADR-889 Φ5 — οι κλάσεις τιμής του χάρτη ζωνών: ποσοστημόρια της περιοχής, όρια πάνω σε πραγματικές τιμές.
 */

import { MAX_PRICE_CLASSES, rampStepOf, valueZonePriceClasses } from '../value-zone-classes';

describe('valueZonePriceClasses', () => {
  it('καμία τιμή ⇒ καμία κλάση', () => {
    expect(valueZonePriceClasses([])).toEqual([]);
  });

  it('μία τιμή ⇒ μία κλάση', () => {
    expect(valueZonePriceClasses([1200, 1200])).toEqual([{ low: 1200, high: 1200 }]);
  });

  it('έως 5 κλάσεις, συνεχόμενες, κάθε όριο ΕΙΝΑΙ τιμή της πηγής, κάθε τιμή σε ακριβώς μία κλάση', () => {
    const prices = [500, 550, 600, 650, 700, 900, 1200, 1500, 2000, 2500, 3850, 8550];
    const classes = valueZonePriceClasses(prices);
    expect(classes.length).toBeLessThanOrEqual(MAX_PRICE_CLASSES);
    for (const item of classes) expect(prices).toContain(item.low);
    for (const price of prices) expect(classes.filter((item) => price >= item.low && price <= item.high)).toHaveLength(1);
    expect(classes[0].low).toBe(500);
    expect(classes[classes.length - 1].high).toBe(8550);
  });

  it('λίγες διακριτές τιμές ⇒ λιγότερες κλάσεις, ποτέ κενή κλάση', () => {
    const classes = valueZonePriceClasses([700, 700, 700, 700, 900]);
    expect(classes).toEqual([{ low: 700, high: 700 }, { low: 900, high: 900 }]);
  });
});

describe('rampStepOf', () => {
  it('απλώνει τις κλάσεις στα άκρα της κλίμακας', () => {
    expect([0, 1].map((i) => rampStepOf(i, 2))).toEqual([1, 5]);
    expect([0, 1, 2, 3, 4].map((i) => rampStepOf(i, 5))).toEqual([1, 2, 3, 4, 5]);
    expect(rampStepOf(0, 1)).toBe(3);
  });
});
