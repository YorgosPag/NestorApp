/**
 * ADR-937 Φάση Α — ηλιασμός όψεων. Τα αναμενόμενα είναι **φυσική**, όχι αντίγραφο της υλοποίησης:
 *
 *   Η1  νότια όψη, Αθήνα, χειμώνας ⇒ ο ήλιος είναι μπροστά της όλη τη μέρα (~9-10 ώρες)
 *   Η2  βόρεια όψη, χειμώνας ⇒ ΚΑΘΟΛΟΥ ήλιος· καλοκαίρι ⇒ λίγος, νωρίς το πρωί και αργά το απόγευμα
 *   Η3  ανατολική όψη, ισημερία ⇒ μόνο πρωί (~6 ώρες)
 *   Η4  δύο όψεις ενώνονται: ποτέ περισσότερες ώρες από τη μέρα, και μία στιγμή μετρά μία φορά
 *   Η5  καμία όψη ή άγνωστο πλάτος ⇒ null (καμία μαντεψιά)
 */

import { facadeSunExposure, type SeasonSunExposure, type SunSeason } from '../facade-sun-exposure';

const ATHENS_LAT = 37.97;

function season(rows: readonly SeasonSunExposure[] | null, name: SunSeason): SeasonSunExposure {
  const row = rows?.find((r) => r.season === name);
  if (!row) throw new Error(`missing season ${name}`);
  return row;
}

describe('facadeSunExposure', () => {
  it('Η1 νότια όψη το χειμώνα παίρνει ήλιο όλη τη μέρα', () => {
    const winter = season(facadeSunExposure(ATHENS_LAT, ['south']), 'winter');
    expect(winter.sunHours).toBeGreaterThanOrEqual(9);
    expect(winter.sunHours).toBeLessThanOrEqual(10.5);
    expect(winter.periods).toEqual(['morning', 'midday', 'afternoon']);
  });

  it('Η2 βόρεια όψη: μηδέν τον χειμώνα, λίγος ήλιος στις άκρες της μέρας το καλοκαίρι', () => {
    const rows = facadeSunExposure(ATHENS_LAT, ['north']);
    expect(season(rows, 'winter').sunHours).toBe(0);
    const summer = season(rows, 'summer');
    expect(summer.sunHours).toBeGreaterThan(0);
    expect(summer.periods).not.toContain('midday');
  });

  it('Η3 ανατολική όψη στην ισημερία: μόνο πρωί', () => {
    const equinox = season(facadeSunExposure(ATHENS_LAT, ['east']), 'equinox');
    expect(equinox.sunHours).toBeGreaterThanOrEqual(5.5);
    expect(equinox.sunHours).toBeLessThanOrEqual(6.5);
    expect(equinox.periods).not.toContain('afternoon');
  });

  it('Η4 η ένωση όψεων δεν διπλομετρά και δεν ξεπερνά τη διάρκεια της μέρας', () => {
    const south = season(facadeSunExposure(ATHENS_LAT, ['south']), 'winter').sunHours;
    const both = season(facadeSunExposure(ATHENS_LAT, ['south', 'southeast']), 'winter').sunHours;
    expect(both).toBe(south);
    const all = season(facadeSunExposure(ATHENS_LAT, ['north', 'south']), 'summer').sunHours;
    expect(all).toBeLessThanOrEqual(15);
  });

  it('Η5 χωρίς όψεις ή χωρίς πλάτος ⇒ null', () => {
    expect(facadeSunExposure(ATHENS_LAT, [])).toBeNull();
    expect(facadeSunExposure(Number.NaN, ['south'])).toBeNull();
  });
});
