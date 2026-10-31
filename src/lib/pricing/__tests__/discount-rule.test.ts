/**
 * Η ΜΙΑ μηχανή εκπτώσεων (ADR-923 §5.11) — αλυσίδα, κλίμακες, στρογγύλευση σε ακέραια λεπτά.
 *
 * @module lib/pricing/__tests__/discount-rule
 */

import {
  BP_PER_WHOLE,
  applyDiscountSteps,
  basisPointsFromPercent,
  discountCascade,
  effectivePercent,
  isDiscountSteps,
  stepsForBasis,
  type DiscountRule,
} from '../discount-rule';

describe('basisPointsFromPercent — η είσοδος σε μονάδες βάσης', () => {
  it('μετατρέπει ποσοστό με έως δύο δεκαδικά ακριβώς', () => {
    expect(basisPointsFromPercent(50)).toBe(5000);
    expect(basisPointsFromPercent(52.25)).toBe(5225);
    expect(basisPointsFromPercent(0.01)).toBe(1);
    // 0.29 * 100 = 28.999999999999996 σε double — η αναπαράσταση δεν κοστίζει μονάδα βάσης
    expect(basisPointsFromPercent(0.29)).toBe(29);
  });

  it('αρνείται ποσοστό με τρίτο δεκαδικό αντί να το στρογγυλέψει σιωπηλά', () => {
    expect(basisPointsFromPercent(1.005)).toBeNull();
    expect(basisPointsFromPercent(33.333)).toBeNull();
  });

  it('αρνείται ό,τι δεν είναι ποσοστό 0–100', () => {
    expect(basisPointsFromPercent(-1)).toBeNull();
    expect(basisPointsFromPercent(100.01)).toBeNull();
    expect(basisPointsFromPercent(Number.NaN)).toBeNull();
    expect(basisPointsFromPercent(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('isDiscountSteps — φρουρός αλυσίδας', () => {
  it('δέχεται ακέραιες μονάδες βάσης 0..10000', () => {
    expect(isDiscountSteps([5000, 1000])).toBe(true);
    expect(isDiscountSteps([])).toBe(true);
  });

  it('αρνείται κλάσματα, αρνητικά και > 100%', () => {
    expect(isDiscountSteps([50.5])).toBe(false);
    expect(isDiscountSteps([-1])).toBe(false);
    expect(isDiscountSteps([BP_PER_WHOLE + 1])).toBe(false);
  });
});

describe('applyDiscountSteps — αλυσίδα «50+10» σε λεπτά', () => {
  it('μονό βήμα: 1.000,00 € −50% ⇒ 500,00 €', () => {
    expect(applyDiscountSteps(100_000, [5000])).toEqual({ discount: 50_000, net: 50_000 });
  });

  it('αλυσίδα: 1.000,00 € «50+10» ⇒ 450,00 € (όχι 400,00 € — τα βήματα ΔΕΝ προστίθενται)', () => {
    expect(applyDiscountSteps(100_000, [5000, 1000])).toEqual({ discount: 55_000, net: 45_000 });
  });

  it('η σειρά των βημάτων δεν αλλάζει το αποτέλεσμα (αντιμεταθετικό γινόμενο)', () => {
    expect(applyDiscountSteps(98_765, [1000, 5000, 250])).toEqual(
      applyDiscountSteps(98_765, [250, 1000, 5000]),
    );
  });

  it('ΜΙΑ στρογγύλευση στο τέλος, όχι ανά βήμα', () => {
    // 0,15 € «50+50». Ανά βήμα: έκπτωση 0,075 → 0,08 ⇒ 0,07· έκπτωση 0,035 → 0,04 ⇒ 0,03.
    // Ακριβώς: καθαρό 0,0375, έκπτωση 0,1125 → 0,11 ⇒ 0,04. Η στρογγύλευση ανά βήμα χάνει ένα λεπτό.
    expect(applyDiscountSteps(15, [5000, 5000])).toEqual({ discount: 11, net: 4 });
  });

  it('στρογγυλεύεται το ΠΟΣΟ ΕΚΠΤΩΣΗΣ μισό-προς-τα-πάνω· το καθαρό = μικτό − έκπτωση (EN 16931)', () => {
    // 0,05 € −10% = 0,005 έκπτωση ⇒ 0,01· καθαρό 0,04 (όπως η ιστορική computeFaDiscount)
    expect(applyDiscountSteps(5, [1000])).toEqual({ discount: 1, net: 4 });
    // 0,04 € −10% = 0,004 ⇒ 0,00
    expect(applyDiscountSteps(4, [1000])).toEqual({ discount: 0, net: 4 });
  });

  it('κενή αλυσίδα / μηδενικό ποσό ⇒ καμία έκπτωση', () => {
    expect(applyDiscountSteps(12_345, [])).toEqual({ discount: 0, net: 12_345 });
    expect(applyDiscountSteps(0, [5000])).toEqual({ discount: 0, net: 0 });
  });

  it('100% ⇒ μηδέν, ποτέ αρνητικό', () => {
    expect(applyDiscountSteps(12_345, [BP_PER_WHOLE])).toEqual({ discount: 12_345, net: 0 });
  });

  it('μεγάλα ποσά χωρίς απώλεια ακρίβειας (BigInt στο γινόμενο)', () => {
    // 90.071.992.547.409,91 € (≈ MAX_SAFE_INTEGER λεπτά) «50+10+5»
    const huge = Number.MAX_SAFE_INTEGER;
    const { discount, net } = applyDiscountSteps(huge, [5000, 1000, 500]);
    expect(discount + net).toBe(huge);
    expect(Number.isSafeInteger(net)).toBe(true);
  });

  it('αρνείται μη έγκυρη είσοδο αντί να βγάλει NaN', () => {
    expect(() => applyDiscountSteps(-1, [1000])).toThrow(RangeError);
    expect(() => applyDiscountSteps(1.5, [1000])).toThrow(RangeError);
    expect(() => applyDiscountSteps(100, [10_001])).toThrow(RangeError);
  });
});

describe('discountCascade — τα ενδιάμεσα της αλυσίδας', () => {
  it('κάθε ενδιάμεσο = η μηχανή στα πρώτα i βήματα, και το τελευταίο = το καθαρό', () => {
    expect(discountCascade(10_000, [5000, 1000])).toEqual([{ step: 5000, net: 5000 }, { step: 1000, net: 4500 }]);
  });

  it('⛔ μία στρογγύλευση από το μικτό, όχι αθροιστική', () => {
    const steps = [3333, 3333, 3333];
    const last = discountCascade(101, steps)[2];
    expect(last.net).toBe(applyDiscountSteps(101, steps).net);
  });

  it('χωρίς βήματα = κενός καταρράκτης', () => {
    expect(discountCascade(10_000, [])).toEqual([]);
  });
});

describe('effectivePercent — η ενιαία ένδειξη μιας αλυσίδας (μόνο για προβολή)', () => {
  it('«50+10» = 55%', () => {
    expect(effectivePercent([5000, 1000])).toBe(55);
  });

  it('«50+10+5» = 57,25%', () => {
    expect(effectivePercent([5000, 1000, 500])).toBe(57.25);
  });

  it('κενή αλυσίδα = 0%', () => {
    expect(effectivePercent([])).toBe(0);
  });
});

describe('stepsForBasis — κλίμακες σε ποσότητα ή ποσό', () => {
  const tiers: DiscountRule = {
    kind: 'tiers',
    basis: 'amount',
    tiers: [
      { min: 1_000_000, steps: [1000] },
      { min: 500_000, steps: [500] },
      { min: 2_000_000, steps: [1500, 500] },
    ],
  };

  it('νικά η ΥΨΗΛΟΤΕΡΗ κλίμακα που φτάνεται, ανεξάρτητα από τη σειρά δήλωσης', () => {
    expect(stepsForBasis(tiers, 1_500_000)).toEqual([1000]);
    expect(stepsForBasis(tiers, 2_000_000)).toEqual([1500, 500]);
  });

  it('το κατώφλι είναι συμπεριληπτικό (≥)', () => {
    expect(stepsForBasis(tiers, 500_000)).toEqual([500]);
  });

  it('κάτω από την πρώτη κλίμακα ⇒ καμία έκπτωση', () => {
    expect(stepsForBasis(tiers, 499_999)).toEqual([]);
  });

  it('αλυσίδα ⇒ τα βήματά της, ανεξάρτητα από τη βάση', () => {
    const chain: DiscountRule = { kind: 'chain', steps: [5000, 1000] };
    expect(stepsForBasis(chain, 0)).toEqual([5000, 1000]);
  });
});
