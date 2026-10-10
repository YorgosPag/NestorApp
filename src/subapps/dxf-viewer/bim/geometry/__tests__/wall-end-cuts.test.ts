/**
 * ADR-911 Φ3α-3 — το ΕΝΑ φράγμα αναστροφής των δύο κοψιμάτων ενός τοίχου
 * (`resolveOpposingEndCuts`) και η εφαρμογή του στη γεωμετρία (`computeWallGeometry`).
 *
 * Το ερώτημα «αναστρέφεται ο άξονας;» αφορά το ΑΘΡΟΙΣΜΑ των δύο κοψιμάτων έναντι του μήκους.
 * Το παλιό όριο 40 % ανά άκρο δεν έβλεπε το απέναντι άκρο: έκοβε νόμιμες ενώσεις (κοντός
 * βραχίονας σε χοντρό γείτονα έμενε με υπόλοιπο μέσα στον γείτονα) χωρίς να προστατεύει κάτι
 * που το άθροισμα δεν προστατεύει ήδη.
 */

import { resolveOpposingEndCuts } from '../wall-end-cuts';
import { computeWallGeometry } from '../wall-geometry';
import { buildDefaultWallParams } from '../../../hooks/drawing/wall-completion';
import type { WallParams } from '../../types/wall-types';

describe('resolveOpposingEndCuts', () => {
  it('όσο μένει σώμα, τα κοψίματα περνούν ΑΥΤΟΥΣΙΑ — και πάνω από το 40 % του μήκους', () => {
    // Καθαρό 100 + 125 μέσα σε γείτονα 250: το κόψιμο είναι το 55,6 % του μήκους και είναι νόμιμο.
    expect(resolveOpposingEndCuts(0, 125, 225, 1)).toEqual({ start: 0, end: 125, swallowed: false });
    expect(resolveOpposingEndCuts(125, 125, 350, 1)).toEqual({ start: 125, end: 125, swallowed: false });
  });

  it('κοψίματα που θα διασταυρώνονταν μικραίνουν ΑΝΑΛΟΓΙΚΑ και αφήνουν ακριβώς το ελάχιστο σώμα', () => {
    const cuts = resolveOpposingEndCuts(300, 100, 201, 1);
    expect(cuts.swallowed).toBe(true);
    expect(cuts.start + cuts.end).toBeCloseTo(200, 9);
    expect(cuts.start / cuts.end).toBeCloseTo(3, 9); // η αναλογία 300:100 κρατιέται
  });

  it('είναι συνεχές στο κατώφλι: ένα έψιλον πριν και ένα έψιλον μετά δίνουν το ίδιο κόψιμο', () => {
    const before = resolveOpposingEndCuts(100, 100 - 1e-9, 201, 1);
    const after = resolveOpposingEndCuts(100, 100 + 1e-9, 201, 1);
    expect(before.swallowed).toBe(false);
    expect(after.swallowed).toBe(true);
    expect(after.start).toBeCloseTo(before.start, 6);
    expect(after.end).toBeCloseTo(before.end, 6);
  });

  it('με μηδενικό ελάχιστο σώμα, «καταπίνεται» ⇔ τα κοψίματα καλύπτουν ΟΛΟ το μήκος', () => {
    expect(resolveOpposingEndCuts(60, 39.999, 100, 0).swallowed).toBe(false);
    expect(resolveOpposingEndCuts(60, 40, 100, 0).swallowed).toBe(true);
    expect(resolveOpposingEndCuts(0, 0, 100, 0)).toEqual({ start: 0, end: 0, swallowed: false });
  });

  it('ένα μόνο κόψιμο μεγαλύτερο από τον τοίχο σταματά στο ελάχιστο σώμα', () => {
    expect(resolveOpposingEndCuts(0, 500, 100, 1)).toEqual({ start: 0, end: 99, swallowed: true });
  });

  it('αρνητικό κόψιμο μετρά ως μηδέν· άξονας μικρότερος από το ελάχιστο σώμα δεν κόβεται', () => {
    expect(resolveOpposingEndCuts(-50, 20, 100, 1)).toEqual({ start: 0, end: 20, swallowed: false });
    expect(resolveOpposingEndCuts(10, 10, 0.5, 1)).toEqual({ start: 0, end: 0, swallowed: true });
  });
});

describe('computeWallGeometry — τα δύο κοψίματα κρίνονται ΜΑΖΙ', () => {
  function geometryOf(lengthMm: number, startBevel: number, endBevel: number) {
    const params: WallParams = {
      ...buildDefaultWallParams({ x: 0, y: 0 }, { x: lengthMm, y: 0 }),
      startBevel,
      endBevel,
    };
    return computeWallGeometry(params, 'straight').axisPolyline.points;
  }

  it('κοντός βραχίονας σε χοντρό γείτονα τελειώνει ΑΚΡΙΒΩΣ στην παρειά (όχι στο 40 %)', () => {
    // Άξονας 225 = καθαρό 100 + μισό πάχος γείτονα 125. Το 40 % θα σταματούσε στα 90 και θα
    // άφηνε 35 mm μέσα στον γείτονα.
    const axis = geometryOf(225, 0, 125);
    expect(axis[0].x).toBeCloseTo(0, 9);
    expect(axis[1].x).toBeCloseTo(100, 9);
  });

  it('δύο μεγάλα κοψίματα ΔΕΝ διασταυρώνονται: ο άξονας κρατά τη φορά του και ελάχιστο σώμα', () => {
    const axis = geometryOf(200, 150, 150);
    expect(axis[1].x).toBeGreaterThan(axis[0].x);
    expect(axis[1].x - axis[0].x).toBeCloseTo(1, 6); // 1 mm — το ελάχιστο σώμα
    expect(axis[0].x).toBeCloseTo(99.5, 6); // ίσα κοψίματα ⇒ συναντιούνται στη μέση
  });

  it('δύο κοψίματα που χωρούν εφαρμόζονται και τα δύο αυτούσια', () => {
    const axis = geometryOf(350, 125, 125);
    expect(axis[0].x).toBeCloseTo(125, 9);
    expect(axis[1].x).toBeCloseTo(225, 9);
  });
});
