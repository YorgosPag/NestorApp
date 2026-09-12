/**
 * Άγκυρες του `computeFreshness` (ADR-332 Φ8 · **D27 Ζ6**).
 *
 * Καθαρός βοηθός — το `nowMs` εγχέεται, ώστε η αριθμητική χρόνου να είναι ντετερμινιστική.
 *
 * ⚠️ **Η υπογραφή δέχεται τη ΔΙΕΥΘΥΝΣΗ, όχι σκέτο `verifiedAt`** (Ζ6): η φρεσκάδα απαντά σε
 * **δύο** ερωτήσεις — *«πότε ρωτήσαμε;»* (ηλικία) και *«τι ρωτήσαμε;»* (ταυτότητα κειμένου).
 * Η δεύτερη ήταν δηλωμένη στον τύπο (`staleReason: 'field-changed'`), μεταφρασμένη στα
 * locale, και **ποτέ παραγόμενη σε παραγωγή**.
 */

import { computeFreshness } from '../helpers/computeFreshness';

const NOW = 1_736_000_000_000; // 2026-01-04T11:33:20Z (παγωμένο σημείο αναφοράς)
const ONE_DAY = 24 * 60 * 60 * 1000;

/** Διεύθυνση **χωρίς** ισχυρισμό μηχανής — μόνο η ηλικία μετρά. */
const at = (verifiedAt: number | null) => ({ street: 'Εγνατία', number: '102', verifiedAt });

describe('computeFreshness — η ηλικία', () => {
  it('«never» όταν το `verifiedAt` λείπει', () => {
    expect(computeFreshness(at(null), NOW)).toEqual({ verifiedAt: null, level: 'never' });
    expect(computeFreshness(undefined, NOW)).toEqual({ verifiedAt: null, level: 'never' });
    expect(computeFreshness({ street: 'Εγνατία' }, NOW)).toEqual({ verifiedAt: null, level: 'never' });
  });

  it('«fresh» κάτω από 24 ώρες, και το `verifiedAt` επιστρέφει αυτούσιο', () => {
    const result = computeFreshness(at(NOW - 12_345), NOW);
    expect(result.level).toBe('fresh');
    expect(result.verifiedAt).toBe(NOW - 12_345);
    expect(result.staleReason).toBeUndefined();
  });

  it('«fresh» ένα χιλιοστό πριν το όριο της ημέρας', () => {
    expect(computeFreshness(at(NOW - (ONE_DAY - 1)), NOW).level).toBe('fresh');
  });

  it('«recent» στο όριο της ημέρας και ως τις 7', () => {
    expect(computeFreshness(at(NOW - ONE_DAY), NOW).level).toBe('recent');
    expect(computeFreshness(at(NOW - 3 * ONE_DAY), NOW).level).toBe('recent');
  });

  it('«aging» στο όριο των 7 ημερών, με λόγο «time-elapsed»', () => {
    const result = computeFreshness(at(NOW - 7 * ONE_DAY), NOW);
    expect(result.level).toBe('aging');
    expect(result.staleReason).toBe('time-elapsed');
    expect(computeFreshness(at(NOW - 14 * ONE_DAY), NOW).level).toBe('aging');
  });

  it('«stale» στο όριο των 30 ημερών και πέρα', () => {
    const result = computeFreshness(at(NOW - 30 * ONE_DAY), NOW);
    expect(result.level).toBe('stale');
    expect(result.staleReason).toBe('time-elapsed');
    expect(computeFreshness(at(NOW - 365 * ONE_DAY), NOW).level).toBe('stale');
  });

  it('χρησιμοποιεί το `Date.now()` όταν το ρολόι δεν δίνεται', () => {
    const spy = jest.spyOn(Date, 'now').mockReturnValue(NOW);
    try {
      expect(computeFreshness(at(NOW - 5000)).level).toBe('fresh');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('Ζ6 — η ΤΑΥΤΟΤΗΤΑ του κειμένου, όχι μόνο η ηλικία', () => {
  const resolvedFor = { street: 'Εγνατία', number: '100', city: 'Θεσσαλονίκη' };
  const metadata = { confidence: 0.91, accuracy: 'exact' as const, variantUsed: 1 };

  it('Ζ6-Ο1 — 🔴 θέση λυμένη για ΑΛΛΟ κείμενο ⇒ «stale / field-changed», ΑΚΟΜΗ ΚΑΙ ΦΡΕΣΚΙΑ', () => {
    // Το ζωντανό δείγμα της ALFA: το έγγραφο λέει «102», η απόδειξη λέει «100».
    // ⚠️ Το `verifiedAt` είναι **πριν από πέντε δευτερόλεπτα** — κατά την ηλικία «fresh».
    //    Μια θέση όμως που λύθηκε για άλλη διεύθυνση δεν είναι φρέσκια με καμία έννοια
    //    χρήσιμη στον άνθρωπο: η ηλικία απαντά «πότε», το Ζ6 απαντά «τι».
    const result = computeFreshness(
      { street: 'Εγνατία', number: '102', city: 'Θεσσαλονίκη', verifiedAt: NOW - 5000, geocodingMetadata: { ...metadata, resolvedFor } },
      NOW,
    );

    expect(result.level).toBe('stale');
    expect(result.staleReason).toBe('field-changed');
    expect(result.verifiedAt).toBe(NOW - 5000);
  });

  it('Ζ6-Ο1β — ίδιο κείμενο ⇒ η ηλικία αποφασίζει κανονικά', () => {
    const result = computeFreshness(
      { ...resolvedFor, verifiedAt: NOW - 5000, geocodingMetadata: { ...metadata, resolvedFor } },
      NOW,
    );

    expect(result.level).toBe('fresh');
    expect(result.staleReason).toBeUndefined();
  });

  it('Ζ6-Ο1γ — ΠΑΛΙΑ εγγραφή χωρίς απόδειξη ⇒ σιωπή, μόνο η ηλικία (άγνοια ≠ κατηγορία)', () => {
    const result = computeFreshness(
      { street: 'Εγνατία', number: '102', verifiedAt: NOW - 5000, geocodingMetadata: metadata },
      NOW,
    );

    expect(result.level).toBe('fresh');
    expect(result.staleReason).toBeUndefined();
  });

  it('Ζ6-Ο1δ — πινέζα ανθρώπου ⇒ καμία απαίτηση απόδειξης', () => {
    const result = computeFreshness(
      { street: 'Εγνατία', number: '102', verifiedAt: NOW - 5000, source: 'dragged' },
      NOW,
    );

    expect(result.level).toBe('fresh');
    expect(result.staleReason).toBeUndefined();
  });
});
