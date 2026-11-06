/**
 * ADR-931 §6 Β1 — εμβαδόν κοινόχρηστου από τη γεωμετρία, με πηγή (καθαρές συναρτήσεις).
 */

import {
  areaDivergenceOf,
  derivedAreaPatch,
  drawnAreaOfGeometries,
  drawnAreaOfGeometry,
  resolveAreaSourcePatch,
} from '@/lib/common-spaces/common-space-area';
import { isCommonSpaceOnPlan } from '@/lib/common-spaces/common-space-plan';

/** Ορθογώνιο `w × h` μέτρων σε canonical mm (ADR-462). */
function rectMm(wM: number, hM: number) {
  const w = wM * 1000;
  const h = hM * 1000;
  return { type: 'polygon', closed: true, vertices: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }] };
}

describe('drawnAreaOfGeometry — mm² → m² από τον ΕΝΑ πίνακα μετατροπής', () => {
  it('ορθογώνιο 4 × 2,5 m ⇒ 10 m²', () => {
    expect(drawnAreaOfGeometry(rectMm(4, 2.5))).toBeCloseTo(10, 9);
  });

  it('η φορά των κορυφών δεν αλλάζει το πρόσημο', () => {
    const cw = { ...rectMm(3, 3), vertices: [...rectMm(3, 3).vertices].reverse() };
    expect(drawnAreaOfGeometry(cw)).toBeCloseTo(9, 9);
  });

  it.each([
    ['ανοιχτή πολυγραμμή', { ...rectMm(2, 2), closed: false }],
    ['λιγότερες από 3 κορυφές', { type: 'polygon', vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }],
    ['μη πολύγωνο', { type: 'line', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }],
    ['μη αριθμητική κορυφή', { type: 'polygon', vertices: [{ x: 0, y: 0 }, { x: 'a', y: 0 }, { x: 0, y: 1 }] }],
    ['μηδενικό εμβαδόν (συγγραμμικά)', { type: 'polygon', vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] }],
    ['τίποτα', undefined],
  ])('%s ⇒ null', (_label, geometry) => {
    expect(drawnAreaOfGeometry(geometry)).toBeNull();
  });
});

describe('drawnAreaOfGeometries — Σ όλων των κατόψεων (Revit Area ανά επίπεδο)', () => {
  it('κλιμακοστάσιο σε τρεις κατόψεις ⇒ άθροισμα, στρογγυλεμένο σε εκατοστό του m²', () => {
    expect(drawnAreaOfGeometries([rectMm(3, 4), rectMm(3, 4), rectMm(3, 4.001)])).toBe(36);
  });

  it('κανένα έγκυρο περίγραμμα ⇒ null («δεν σχεδιάστηκε»), όχι 0', () => {
    expect(drawnAreaOfGeometries([])).toBeNull();
    expect(drawnAreaOfGeometries([{ type: 'line' }])).toBeNull();
  });
});

describe('derivedAreaPatch — τι γράφει ο server όταν άλλαξε το σχέδιο', () => {
  it('ίδιο σχέδιο ⇒ {} (καμία γραφή, κανένα ίχνος — ιδεμποτικό)', () => {
    expect(derivedAreaPatch({ drawnArea: 12, area: 11 }, 12)).toEqual({});
  });

  it('δήλωση ανθρώπου ⇒ αλλάζει ΜΟΝΟ το drawnArea, το area μένει', () => {
    expect(derivedAreaPatch({ drawnArea: 12, area: 11, areaSource: 'declared' }, 13)).toEqual({ drawnArea: 13 });
  });

  it('δεμένο στο σχέδιο ⇒ το area ακολουθεί', () => {
    expect(derivedAreaPatch({ drawnArea: 12, area: 12, areaSource: 'drawn' }, 13)).toEqual({ drawnArea: 13, area: 13 });
  });

  it('σχέδιο που χάθηκε ⇒ σβήνει το drawnArea, ΔΕΝ σβήνει τη δήλωση', () => {
    expect(derivedAreaPatch({ drawnArea: 12, area: 12, areaSource: 'drawn' }, null)).toEqual({ drawnArea: null });
  });
});

describe('resolveAreaSourcePatch — η απόφαση του ανθρώπου', () => {
  it('«υιοθέτησε το σχεδιασμένο» ⇒ area από τη ΒΑΣΗ, όχι από τον πελάτη', () => {
    expect(resolveAreaSourcePatch({ areaSource: 'drawn' }, { drawnArea: 14.2, area: 12 }))
      .toEqual({ kind: 'ok', fields: { area: 14.2, areaSource: 'drawn' } });
  });

  it('υιοθέτηση χωρίς σχέδιο ⇒ άρνηση', () => {
    expect(resolveAreaSourcePatch({ areaSource: 'drawn' }, { area: 12 }))
      .toEqual({ kind: 'rejected', reason: 'no-drawn-area' });
  });

  it('υιοθέτηση ΚΑΙ αριθμός μαζί ⇒ άρνηση (δύο αλήθειες σε ένα αίτημα)', () => {
    expect(resolveAreaSourcePatch({ areaSource: 'drawn', area: 10 }, { drawnArea: 14 }))
      .toEqual({ kind: 'rejected', reason: 'area-with-drawn-source' });
  });

  it('νέα τιμή από άνθρωπο ⇒ η πηγή γίνεται declared (κόβει τη δέσμευση ρητά)', () => {
    expect(resolveAreaSourcePatch({ area: 10 }, { area: 12, areaSource: 'drawn' }))
      .toEqual({ kind: 'ok', fields: { areaSource: 'declared' } });
  });

  it('φόρμα που ξαναστέλνει την ΙΔΙΑ τιμή ⇒ η δέσμευση μένει', () => {
    expect(resolveAreaSourcePatch({ area: 12 }, { area: 12, areaSource: 'drawn' }))
      .toEqual({ kind: 'ok', fields: {} });
  });
});

describe('areaDivergenceOf — σήμα, ποτέ διόρθωση', () => {
  it('> 2% ⇒ διαφωνία με τον λόγο της', () => {
    const result = areaDivergenceOf({ area: 100, drawnArea: 103 });
    expect(result).toEqual({ kind: 'diverges', declared: 100, drawn: 103, ratio: expect.closeTo(0.03, 9) });
  });

  it('≤ 2% ⇒ καμία', () => {
    expect(areaDivergenceOf({ area: 100, drawnArea: 101.5 })).toEqual({ kind: 'none' });
  });

  it('δεμένο στο σχέδιο ή λείπει ένα από τα δύο ⇒ καμία', () => {
    expect(areaDivergenceOf({ area: 100, drawnArea: 150, areaSource: 'drawn' })).toEqual({ kind: 'none' });
    expect(areaDivergenceOf({ drawnArea: 150 })).toEqual({ kind: 'none' });
    expect(areaDivergenceOf({ area: 100 })).toEqual({ kind: 'none' });
  });
});

describe('isCommonSpaceOnPlan — η ΙΔΙΑ κρίση για επιλογέα και server', () => {
  it('χώρος ορόφου ⇒ μόνο στη δική του κάτοψη', () => {
    expect(isCommonSpaceOnPlan({ floorId: 'f1' }, 'f1')).toBe(true);
    expect(isCommonSpaceOnPlan({ floorId: 'f1' }, 'f2')).toBe(false);
  });

  it('χώρος χωρίς όροφο (όλο το κτίριο) ⇒ σε κάθε κάτοψη', () => {
    expect(isCommonSpaceOnPlan({}, 'f2')).toBe(true);
    expect(isCommonSpaceOnPlan({ floorId: null }, 'f2')).toBe(true);
  });

  it('κάτοψη χωρίς όροφο ⇒ κανένας περιορισμός ορόφου', () => {
    expect(isCommonSpaceOnPlan({ floorId: 'f1' }, undefined)).toBe(true);
  });
});
