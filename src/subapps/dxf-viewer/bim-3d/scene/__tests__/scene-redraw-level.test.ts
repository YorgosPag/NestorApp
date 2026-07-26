/**
 * ADR-549 Φ4 — Redraw-level SSoT tests + **EXHAUSTIVE ANCHORS**.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (incident 2026-07-26): το προηγούμενο σχήμα ήταν N booleans, και το test του ήταν
 * ΧΕΙΡΟΓΡΑΦΟ ΑΝΑ ΠΕΔΙΟ. Όταν το ADR-549 Φ3 πρόσθεσε το overlay επίπεδο, κανείς δεν πρόσθεσε ούτε τον
 * όρο στο gate ούτε το test — και το suite έμεινε **πράσινο**, γιατί καθρέφτιζε τον κώδικα αντί να
 * τον ελέγχει. Το BIM hover silhouette (κολώνες) δεν ζωγραφιζόταν ΠΟΤΕ.
 *
 * Τα anchors εδώ παράγονται από τον ΙΔΙΟ τον ορισμό (`allDirtyRedrawLevels`), όχι από λίστα γραμμένη
 * στο χέρι: ένα νέο `RedrawLevel` μπαίνει αυτόματα υπό έλεγχο. Ένα anchor που δεν καλύπτει αυτό που
 * θα προστεθεί αύριο δεν είναι anchor — είναι σχόλιο.
 */

import {
  RedrawLevel,
  escalateRedraw,
  needsRedraw,
  isOverlayOnlyRedraw,
  allDirtyRedrawLevels,
} from '../scene-redraw-level';

describe('RedrawLevel — ordered cost scale', () => {
  it('είναι γνησίως αύξουσα κατά κόστος (η ΣΕΙΡΑ είναι ο μηχανισμός)', () => {
    expect(RedrawLevel.NONE).toBeLessThan(RedrawLevel.OVERLAY);
    expect(RedrawLevel.OVERLAY).toBeLessThan(RedrawLevel.FULL);
  });

  it('allDirtyRedrawLevels επιστρέφει κάθε επίπεδο εκτός του NONE', () => {
    const levels = allDirtyRedrawLevels();
    expect(levels).not.toContain(RedrawLevel.NONE);
    expect(levels).toHaveLength(Object.keys(RedrawLevel).length - 1);
  });
});

describe('needsRedraw', () => {
  it('NONE δεν ζητά καρέ (ο scheduler προσπερνά το σύστημα)', () => {
    expect(needsRedraw(RedrawLevel.NONE)).toBe(false);
  });

  // EXHAUSTIVE ANCHOR — νέο επίπεδο καλύπτεται αυτόματα.
  it.each(allDirtyRedrawLevels())('επίπεδο %s ζητά καρέ', (level) => {
    expect(needsRedraw(level)).toBe(true);
  });
});

describe('escalateRedraw — monotonic escalation', () => {
  it('ανεβάζει όταν το αίτημα είναι ακριβότερο', () => {
    expect(escalateRedraw(RedrawLevel.NONE, RedrawLevel.OVERLAY)).toBe(RedrawLevel.OVERLAY);
    expect(escalateRedraw(RedrawLevel.OVERLAY, RedrawLevel.FULL)).toBe(RedrawLevel.FULL);
  });

  /**
   * ΤΟ ΚΡΙΣΙΜΟ ANCHOR: ένα overlay αίτημα που φτάνει ΜΕΤΑ από ένα `markSceneDirty` δεν επιτρέπεται
   * να υποβαθμίσει το εκκρεμές full render — αλλιώς η γεωμετρική αλλαγή χάνεται για ένα καρέ και
   * εμφανίζεται μόνο όταν κάτι άλλο ζητήσει redraw (ακριβώς το σύμπτωμα του incident).
   */
  it('ΔΕΝ υποβαθμίζει ποτέ εκκρεμές ακριβότερο αίτημα', () => {
    expect(escalateRedraw(RedrawLevel.FULL, RedrawLevel.OVERLAY)).toBe(RedrawLevel.FULL);
    expect(escalateRedraw(RedrawLevel.FULL, RedrawLevel.NONE)).toBe(RedrawLevel.FULL);
    expect(escalateRedraw(RedrawLevel.OVERLAY, RedrawLevel.NONE)).toBe(RedrawLevel.OVERLAY);
  });

  it('είναι idempotent (διπλό αίτημα = ίδιο αποτέλεσμα, καμία διπλοεγγραφή)', () => {
    for (const level of Object.values(RedrawLevel)) {
      expect(escalateRedraw(level, level)).toBe(level);
      expect(escalateRedraw(escalateRedraw(level, level), level)).toBe(level);
    }
  });

  it('κάθε ακολουθία αιτημάτων καταλήγει στο max — ανεξάρτητα σειράς (commutative fold)', () => {
    const seq = [RedrawLevel.OVERLAY, RedrawLevel.FULL, RedrawLevel.NONE, RedrawLevel.OVERLAY];
    const fold = (order: readonly RedrawLevel[]): RedrawLevel =>
      order.reduce<RedrawLevel>((acc, l) => escalateRedraw(acc, l), RedrawLevel.NONE);
    expect(fold(seq)).toBe(RedrawLevel.FULL);
    expect(fold([...seq].reverse())).toBe(RedrawLevel.FULL);
  });
});

describe('isOverlayOnlyRedraw — ποιο επίπεδο δικαιούται τη φθηνή διαδρομή', () => {
  it('μόνο το OVERLAY παίρνει το blit+outline καρέ', () => {
    expect(isOverlayOnlyRedraw(RedrawLevel.OVERLAY)).toBe(true);
  });

  it('το FULL ΔΕΝ παίρνει τη φθηνή διαδρομή (θα έδειχνε παλιό beauty)', () => {
    expect(isOverlayOnlyRedraw(RedrawLevel.FULL)).toBe(false);
  });

  it('το NONE δεν δικαιούται ούτε blit', () => {
    expect(isOverlayOnlyRedraw(RedrawLevel.NONE)).toBe(false);
  });
});
