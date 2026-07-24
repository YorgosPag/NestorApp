/**
 * ADR-692 Φ2 — screen-space primitives του 3D marquee.
 * Το κρίσιμο: ΑΝΟΙΧΤΟ πολύγραμμο ΔΕΝ είναι πολύγωνο — ένα ορθογώνιο στην «κοιλιά» ενός Γ
 * σχήματος ΔΕΝ πρέπει να το πιάνει, ενώ σε ΚΛΕΙΣΤΟ σχήμα (κύκλος/κουτί) πρέπει.
 */

import {
  screenBounds,
  polylineIntersectsRect,
  isClosedPolyline,
} from '../marquee-screen-geometry';

const rect = { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } };

describe('screenBounds', () => {
  it('επιστρέφει null σε κενή είσοδο', () => {
    expect(screenBounds([])).toBeNull();
  });

  it('περικλείει όλα τα σημεία', () => {
    expect(screenBounds([{ x: 2, y: -1 }, { x: -3, y: 5 }])).toEqual({
      min: { x: -3, y: -1 },
      max: { x: 2, y: 5 },
    });
  });
});

describe('isClosedPolyline', () => {
  it('true όταν το τελευταίο σημείο επαναλαμβάνει το πρώτο', () => {
    expect(isClosedPolyline([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 0 }])).toBe(true);
  });

  it('false σε ανοιχτό πολύγραμμο', () => {
    expect(isClosedPolyline([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }])).toBe(false);
  });

  it('false σε τμήμα δύο σημείων (γραμμή)', () => {
    expect(isClosedPolyline([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(false);
  });
});

describe('polylineIntersectsRect', () => {
  it('γραμμή που περνά μέσα από το ορθογώνιο = hit', () => {
    expect(polylineIntersectsRect([{ x: -5, y: 5 }, { x: 15, y: 5 }], false, rect)).toBe(true);
  });

  it('γραμμή εντελώς έξω = miss', () => {
    expect(polylineIntersectsRect([{ x: 20, y: 20 }, { x: 30, y: 30 }], false, rect)).toBe(false);
  });

  it('κορυφή μέσα στο ορθογώνιο = hit', () => {
    expect(polylineIntersectsRect([{ x: 5, y: 5 }, { x: 50, y: 50 }], false, rect)).toBe(true);
  });

  it('ΚΛΕΙΣΤΟ σχήμα που περικλείει το ορθογώνιο = hit (containment)', () => {
    const big = [
      { x: -100, y: -100 }, { x: 100, y: -100 }, { x: 100, y: 100 }, { x: -100, y: 100 },
      { x: -100, y: -100 },
    ];
    expect(polylineIntersectsRect(big, true, rect)).toBe(true);
  });

  it('ΑΝΟΙΧΤΟ Γ γύρω από το ορθογώνιο = miss (δεν υπάρχει «μέσα»)', () => {
    const open = [{ x: -100, y: -100 }, { x: 100, y: -100 }, { x: 100, y: 100 }];
    expect(polylineIntersectsRect(open, false, rect)).toBe(false);
  });

  it('μονό σημείο μέσα = hit', () => {
    expect(polylineIntersectsRect([{ x: 5, y: 5 }], false, rect)).toBe(true);
  });

  it('κενή είσοδος = miss', () => {
    expect(polylineIntersectsRect([], false, rect)).toBe(false);
  });
});
