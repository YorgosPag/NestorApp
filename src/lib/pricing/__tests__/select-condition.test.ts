/**
 * Επιλογή συνθήκης (ADR-923 §5.11): σκληρά φίλτρα → ο ειδικότερος νικά → ισοπαλία = ασάφεια, με ίχνος.
 * Μαζί η ημιανοιχτή ισχύς και το ποσό γραμμής ανά ποσότητα τιμής.
 *
 * @module lib/pricing/__tests__/select-condition
 */

import { lineAmount } from '../line-amount';
import { compareSpecificity, selectMostSpecific, type SelectionCandidate } from '../select-condition';
import { isEmptyWindow, validityAt, windowsOverlap } from '../validity';
import { compareDiscountSteps } from '../discount-rule';

type Reason = 'audienceMismatch';

const always = { fromMs: null, untilMs: null };

function candidate(id: string, specificity: number[], extra: Partial<SelectionCandidate<string, Reason>> = {}): SelectionCandidate<string, Reason> {
  return { id, item: id, validity: always, mismatch: null, specificity, ...extra };
}

describe('validity — ημιανοιχτό [from, until)', () => {
  it('η λήξη δεν ανήκει στο διάστημα, η έναρξη ανήκει', () => {
    const window = { fromMs: 100, untilMs: 200 };
    expect(validityAt(window, 99)).toBe('notYetValid');
    expect(validityAt(window, 100)).toBe('valid');
    expect(validityAt(window, 199)).toBe('valid');
    expect(validityAt(window, 200)).toBe('expired');
  });

  it('«έως 200» και «από 200» δεν επικαλύπτονται· απεριόριστα άκρα επικαλύπτουν τα πάντα', () => {
    expect(windowsOverlap({ fromMs: null, untilMs: 200 }, { fromMs: 200, untilMs: null })).toBe(false);
    expect(windowsOverlap({ fromMs: null, untilMs: 201 }, { fromMs: 200, untilMs: null })).toBe(true);
    expect(windowsOverlap(always, { fromMs: 5, untilMs: 6 })).toBe(true);
  });

  it('κενό ή ανάποδο διάστημα', () => {
    expect(isEmptyWindow({ fromMs: 200, untilMs: 200 })).toBe(true);
    expect(isEmptyWindow({ fromMs: 200, untilMs: 100 })).toBe(true);
    expect(isEmptyWindow({ fromMs: null, untilMs: 100 })).toBe(false);
  });
});

describe('selectMostSpecific', () => {
  it('ο ειδικότερος νικά ανεξάρτητα από τη σειρά δήλωσης — και το ίχνος λέει γιατί έχασαν οι άλλοι', () => {
    const result = selectMostSpecific([candidate('general', [0, 0]), candidate('specific', [2, 1]), candidate('mid', [2, 0])], 0);
    expect(result.kind).toBe('selected');
    if (result.kind !== 'selected') return;
    expect(result.winnerId).toBe('specific');
    expect(result.trace).toEqual([
      { id: 'general', verdict: 'outranked' },
      { id: 'specific', verdict: 'selected' },
      { id: 'mid', verdict: 'outranked' },
    ]);
  });

  it('η πρώτη διάσταση μετρά πρώτη (κοινό πριν από ομάδα)', () => {
    expect(compareSpecificity([3, 0], [2, 1])).toBeGreaterThan(0);
    expect(compareSpecificity([2], [2, 0])).toBe(0);
  });

  it('τα σκληρά φίλτρα απορρίπτουν πριν από την ειδικότητα, με τον λόγο τους', () => {
    const result = selectMostSpecific(
      [
        candidate('foreign', [3, 1], { mismatch: 'audienceMismatch' }),
        candidate('future', [3, 1], { validity: { fromMs: 10, untilMs: null } }),
        candidate('past', [3, 1], { validity: { fromMs: null, untilMs: 5 } }),
        candidate('fallback', [0, 0]),
      ],
      5,
    );
    expect(result.kind === 'selected' && result.winnerId).toBe('fallback');
    expect(result.trace.map((entry) => entry.verdict)).toEqual(['audienceMismatch', 'notYetValid', 'expired', 'selected']);
  });

  it('ισοπαλία = ασάφεια, ποτέ «ο πρώτος» (Odoo)', () => {
    const result = selectMostSpecific([candidate('a', [1, 1]), candidate('b', [1, 1]), candidate('c', [0, 0])], 0);
    expect(result.kind).toBe('ambiguous');
    if (result.kind !== 'ambiguous') return;
    expect(result.tiedIds).toEqual(['a', 'b']);
    expect(result.trace.map((entry) => entry.verdict)).toEqual(['tied', 'tied', 'outranked']);
  });

  it('κανένας έγκυρος ⇒ none', () => {
    expect(selectMostSpecific([candidate('x', [1], { mismatch: 'audienceMismatch' })], 0).kind).toBe('none');
    expect(selectMostSpecific([], 0).kind).toBe('none');
  });
});

describe('lineAmount — τιμή ανά ποσότητα τιμής, μία στρογγύλευση', () => {
  const base = { quantityDecimals: 3 };

  it('12,5 m × 84,00 € «ανά 100 m» = 10,50 €', () => {
    expect(lineAmount({ ...base, unitPrice: 8400, perQuantity: 100, quantity: 12.5 })).toBe(1050);
  });

  it('στρογγυλεύει μισό-προς-τα-πάνω μία φορά: 3 × 0,05 € «ανά 10» = 0,015 → 0,02 €', () => {
    expect(lineAmount({ ...base, unitPrice: 5, perQuantity: 10, quantity: 3 })).toBe(2);
  });

  it('αρνείται ποσότητα με περισσότερα δεκαδικά, μηδενική ή αρνητική', () => {
    expect(lineAmount({ ...base, unitPrice: 100, perQuantity: 1, quantity: 1.0005 })).toBeNull();
    expect(lineAmount({ ...base, unitPrice: 100, perQuantity: 1, quantity: 0 })).toBeNull();
    expect(lineAmount({ ...base, unitPrice: 100, perQuantity: 1, quantity: -2 })).toBeNull();
    expect(lineAmount({ ...base, unitPrice: 1.5, perQuantity: 1, quantity: 1 })).toBeNull();
  });
});

describe('compareDiscountSteps — ακριβής σύγκριση αλυσίδων', () => {
  it('«50+10» ισοδυναμεί με «55» και δίνει περισσότερο από «50»', () => {
    expect(compareDiscountSteps([5000, 1000], [5500])).toBe(0);
    expect(compareDiscountSteps([5000, 1000], [5000])).toBe(1);
    expect(compareDiscountSteps([], [1])).toBe(-1);
  });
});
