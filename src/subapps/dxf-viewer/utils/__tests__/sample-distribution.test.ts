/**
 * SSoT κατανομής δειγμάτων — ADR-726 §5.
 *
 * Το module είναι καθαρό (μηδέν DOM/χρόνος), άρα ελέγχεται εξαντλητικά. Οι έλεγχοι κλειδώνουν
 * τη **σύμβαση** (nearest-rank) και τις δύο αποφάσεις που είναι εύκολο να «διορθωθούν» λάθος
 * από τον επόμενο: κενή είσοδος ⇒ `null`/`NaN` (ποτέ `0`), και υπέρβαση κατωφλίου **αυστηρά** `>`.
 */

import {
  percentileOfSorted,
  summariseSamples,
} from '../sample-distribution';

describe('percentileOfSorted — σύμβαση nearest-rank', () => {
  const oneToHundred = Array.from({ length: 100 }, (_, i) => i + 1);

  it('επιστρέφει πραγματικό παρατηρημένο δείγμα, ποτέ παρεμβολή', () => {
    // Ανάμεσα σε 10 και 20 δεν υπάρχει δείγμα· η nearest-rank δεν εφευρίσκει το 15.
    expect(percentileOfSorted([10, 20], 0.5)).toBe(10);
    expect(percentileOfSorted([10, 20], 0.51)).toBe(20);
  });

  it('ceil(n·p) − 1 για τα κανονικά ποσοστημόρια σε n=100', () => {
    expect(percentileOfSorted(oneToHundred, 0.5)).toBe(50);
    expect(percentileOfSorted(oneToHundred, 0.9)).toBe(90);
    expect(percentileOfSorted(oneToHundred, 0.95)).toBe(95);
    expect(percentileOfSorted(oneToHundred, 0.99)).toBe(99);
  });

  it('p=1 δίνει το μέγιστο, p=0 δίνει το ελάχιστο', () => {
    expect(percentileOfSorted(oneToHundred, 1)).toBe(100);
    expect(percentileOfSorted(oneToHundred, 0)).toBe(1);
  });

  it('περιορίζει p εκτός [0,1] αντί να βγει εκτός πίνακα', () => {
    expect(percentileOfSorted(oneToHundred, 1.5)).toBe(100);
    expect(percentileOfSorted(oneToHundred, -0.2)).toBe(1);
  });

  it('ένα δείγμα ⇒ το ίδιο δείγμα για κάθε p', () => {
    expect(percentileOfSorted([42], 0.5)).toBe(42);
    expect(percentileOfSorted([42], 0.99)).toBe(42);
  });

  it('🔴 κενή είσοδος ⇒ NaN, ΟΧΙ 0 — απουσία μέτρησης δεν είναι τέλεια απόδοση', () => {
    expect(percentileOfSorted([], 0.9)).toBeNaN();
  });
});

describe('summariseSamples', () => {
  it('🔴 κενή είσοδος ⇒ null, ΟΧΙ κατανομή με μηδενικά', () => {
    expect(summariseSamples([])).toBeNull();
  });

  it('δεν τροποποιεί τον πίνακα εισόδου', () => {
    const input = [30, 10, 20];
    summariseSamples(input);
    expect(input).toEqual([30, 10, 20]);
  });

  it('ταξινομεί αριθμητικά, όχι λεξικογραφικά', () => {
    // Το προεπιλεγμένο Array.sort() θα έδινε [10, 100, 9] και max = 9.
    const dist = summariseSamples([9, 100, 10]);
    expect(dist?.min).toBe(9);
    expect(dist?.max).toBe(100);
  });

  it('υπολογίζει count / sum / min / max / avg', () => {
    const dist = summariseSamples([1, 2, 3, 4]);
    expect(dist).toMatchObject({ count: 4, sum: 10, min: 1, max: 4, avg: 2.5 });
  });

  it('τα ποσοστημόρια συμφωνούν με το percentileOfSorted', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    const dist = summariseSamples(values);
    expect(dist).toMatchObject({ p50: 50, p75: 75, p90: 90, p95: 95, p99: 99 });
  });
});

describe('summariseSamples — υπέρβαση κατωφλίου (ADR-726 §5)', () => {
  it('χωρίς κατώφλια, το exceedance είναι κενό', () => {
    expect(summariseSamples([1, 2, 3])?.exceedance).toEqual([]);
  });

  it('🔴 μετρά ΑΥΣΤΗΡΑ > κατώφλι — τιμή ίση με το κατώφλι ΔΕΝ το ξεπερνά', () => {
    const dist = summariseSamples([70, 70, 70, 71], [70]);
    expect(dist?.exceedance[0]).toEqual({ thresholdMs: 70, count: 1, share: 0.25 });
  });

  it('αναπαράγει το κριτήριο «καρέ > 70ms» σε ρεαλιστικό δείγμα', () => {
    // 84 από 525 καρέ >70ms = 16% — η μετρημένη κατάσταση του ADR-726 §4.
    const fast = Array.from({ length: 441 }, () => 16);
    const slow = Array.from({ length: 84 }, () => 120);
    const dist = summariseSamples([...fast, ...slow], [70]);
    expect(dist?.exceedance[0].count).toBe(84);
    expect(dist?.exceedance[0].share).toBeCloseTo(0.16, 2);
  });

  it('κρατά τη σειρά των κατωφλίων όπως δόθηκαν', () => {
    const dist = summariseSamples([10, 20, 40, 80], [70, 16.7, 33]);
    expect(dist?.exceedance.map((e) => e.thresholdMs)).toEqual([70, 16.7, 33]);
    expect(dist?.exceedance.map((e) => e.count)).toEqual([1, 3, 2]);
  });

  it('όλα κάτω / όλα πάνω από το κατώφλι', () => {
    expect(summariseSamples([1, 2], [70])?.exceedance[0]).toMatchObject({ count: 0, share: 0 });
    expect(summariseSamples([80, 90], [70])?.exceedance[0]).toMatchObject({ count: 2, share: 1 });
  });

  it('η δυαδική αναζήτηση συμφωνεί με ωμή καταμέτρηση σε ψευδοτυχαίο δείγμα', () => {
    // Ντετερμινιστικό LCG — κανένα Math.random() σε test.
    let seed = 12345;
    const values = Array.from({ length: 1000 }, () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return (seed % 20000) / 100;
    });
    for (const threshold of [0, 16.7, 70, 199.99, 500]) {
      const brute = values.filter((v) => v > threshold).length;
      expect(summariseSamples(values, [threshold])?.exceedance[0].count).toBe(brute);
    }
  });
});
