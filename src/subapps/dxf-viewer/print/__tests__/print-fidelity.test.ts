/**
 * ADR-667 Φ1 — print fidelity report.
 *
 * Το bug που κλειδώνει: το vector PDF υποβάθμιζε **σιωπηλά** τα γεμίσματα εικόνας σε συμπαγές
 * χρώμα (τοπογραφική επιφάνεια → γκρι) και τα warnings του pre-pass **πετιούνταν**. Τα tests
 * εδώ κατοχυρώνουν ότι κάθε κωδικός υποβάθμισης γίνεται **μετρήσιμη** σημείωση — και ότι ένα
 * πιστό PDF παραμένει **σιωπηλό** (καμία ενόχληση χωρίς λόγο).
 */

import {
  summarizePrintFidelity,
  mergePrintFidelity,
  type PrintFidelityNote,
} from '../print-fidelity';

describe('summarizePrintFidelity (ADR-667 Φ1)', () => {
  it('πιστό PDF (μηδέν warnings) → καμία σημείωση ⇒ κανένα toast', () => {
    expect(summarizePrintFidelity([])).toEqual([]);
  });

  it('pattern-cap — ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: η επιφάνεια που έβγαινε γκρι, τώρα αναφέρεται', () => {
    expect(summarizePrintFidelity(['image-fill:pattern-cap'])).toEqual([
      { code: 'hatch-image-solid', count: 1 },
    ]);
  });

  it('και οι τρεις αιτίες image-fill πέφτουν στο ΙΔΙΟ είδος, με άθροισμα πλήθους', () => {
    const notes = summarizePrintFidelity([
      'image-fill:pattern-cap',
      'image-fill:decode-failed',
      'image-fill:encode-failed',
    ]);
    // Ο χρήστης θέλει «3 γεμίσματα έγιναν συμπαγή», όχι 3 διαφορετικά μηνύματα.
    expect(notes).toEqual([{ code: 'hatch-image-solid', count: 3 }]);
  });

  it('«γυμνή» εικόνα → ξεχωριστό είδος (παραλείπεται, δεν υποβαθμίζεται σε χρώμα)', () => {
    expect(summarizePrintFidelity(['image-entity:decode-failed'])).toEqual([
      { code: 'image-dropped', count: 1 },
    ]);
  });

  it('ανάμεικτα είδη → ένα entry ανά είδος, με σωστά πλήθη', () => {
    const notes = summarizePrintFidelity([
      'image-fill:pattern-cap',
      'image-entity:decode-failed',
      'image-fill:pattern-cap',
    ]);
    expect(notes).toHaveLength(2);
    expect(notes).toEqual(
      expect.arrayContaining([
        { code: 'hatch-image-solid', count: 2 },
        { code: 'image-dropped', count: 1 },
      ]),
    );
  });

  it('άγνωστος κωδικός αγνοείται — ποτέ ακατανόητο toast στον χρήστη', () => {
    expect(summarizePrintFidelity(['something:we-do-not-know'])).toEqual([]);
  });

  it('άγνωστοι κωδικοί ΔΕΝ κρύβουν τους γνωστούς που τους συνοδεύουν', () => {
    expect(summarizePrintFidelity(['nonsense:code', 'image-fill:pattern-cap'])).toEqual([
      { code: 'hatch-image-solid', count: 1 },
    ]);
  });
});

describe('mergePrintFidelity — σετ φύλλων (ADR-651 Φ.Ζ → ΕΝΑ PDF)', () => {
  it('N φύλλα → ΕΝΑ άθροισμα ανά είδος (όχι ένα toast ανά όροφο)', () => {
    const sheetA: PrintFidelityNote[] = [{ code: 'hatch-image-solid', count: 2 }];
    const sheetB: PrintFidelityNote[] = [
      { code: 'hatch-image-solid', count: 3 },
      { code: 'image-dropped', count: 1 },
    ];
    const merged = mergePrintFidelity([sheetA, sheetB]);
    expect(merged).toEqual(
      expect.arrayContaining([
        { code: 'hatch-image-solid', count: 5 },
        { code: 'image-dropped', count: 1 },
      ]),
    );
    expect(merged).toHaveLength(2);
  });

  it('όλα τα φύλλα πιστά → καμία σημείωση', () => {
    expect(mergePrintFidelity([[], [], []])).toEqual([]);
  });

  it('κενό σετ → καμία σημείωση', () => {
    expect(mergePrintFidelity([])).toEqual([]);
  });
});
