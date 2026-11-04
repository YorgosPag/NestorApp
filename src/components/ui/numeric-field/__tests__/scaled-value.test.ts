import { isMinorAmount } from '@/lib/money/money';
import { isBasisPoints } from '@/lib/pricing/discount-rule';
import { MILLI_QUANTITY_SCALE, modelOfDisplay, MONEY_SCALE, PERCENT_SCALE } from '../scaled-value';

describe('scaled-value — ακέραιο μοντέλο ↔ φόρμα (ADR-928 Φ3γ-2)', () => {
  it('έγκυρες τιμές περνούν από τους μετατροπείς του μοντέλου', () => {
    expect(modelOfDisplay(12.34, MONEY_SCALE)).toBe(1234);
    expect(modelOfDisplay(1.005, MONEY_SCALE)).toBe(101);
    expect(modelOfDisplay(5.25, PERCENT_SCALE)).toBe(525);
    expect(modelOfDisplay(12.5, MILLI_QUANTITY_SCALE)).toBe(12_500);
  });

  it('τρίτο δεκαδικό ποσοστού: ΔΕΝ στρογγυλεύεται — περνά ακριβές και ο επικυρωτής το λέει άκυρο', () => {
    const model = modelOfDisplay(5.255, PERCENT_SCALE);
    expect(model).toBe(525.5);
    expect(isBasisPoints(model)).toBe(false);
    expect(PERCENT_SCALE.toDisplay(model)).toBe(5.255);
  });

  it('τέταρτο δεκαδικό ποσότητας: άκυρο, ξαναδείχνεται όπως γράφτηκε', () => {
    const model = modelOfDisplay(1.0005, MILLI_QUANTITY_SCALE);
    expect(Number.isInteger(model)).toBe(false);
    expect(MILLI_QUANTITY_SCALE.toDisplay(model)).toBe(1.0005);
  });

  it('ποσό: το μοντέλο στρογγυλεύει στο λεπτό (η ΜΙΑ στρογγύλευση του `minorFromMajor`)', () => {
    expect(isMinorAmount(modelOfDisplay(19.999, MONEY_SCALE))).toBe(true);
  });

  it('στρογγυλή διαδρομή για ακέραια μοντέλα', () => {
    for (const scale of [MONEY_SCALE, PERCENT_SCALE, MILLI_QUANTITY_SCALE]) {
      for (const model of [0, 1, 99, 525, 10_000]) expect(modelOfDisplay(scale.toDisplay(model), scale)).toBe(model);
    }
  });
});
