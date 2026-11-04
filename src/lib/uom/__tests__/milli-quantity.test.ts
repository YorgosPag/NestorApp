import { milliFromQuantity, quantityFromMilli } from '../milli-quantity';

describe('milli-quantity (ADR-928 Φ3γ-2)', () => {
  it.each([
    [12.5, 12_500],
    [0, 0],
    [0.001, 1],
    [30, 30_000],
    [1.2, 1_200],
  ])('%p → %p χιλιοστά', (quantity, milli) => {
    expect(milliFromQuantity(quantity)).toBe(milli);
  });

  it.each([1.0005, -1, Number.NaN, Number.POSITIVE_INFINITY])('%p ⇒ null (καμία σιωπηλή στρογγύλευση)', (quantity) => {
    expect(milliFromQuantity(quantity)).toBeNull();
  });

  it('στρογγυλή διαδρομή', () => {
    for (const milli of [0, 1, 999, 12_500, 1_234_567]) {
      expect(milliFromQuantity(quantityFromMilli(milli))).toBe(milli);
    }
  });
});
