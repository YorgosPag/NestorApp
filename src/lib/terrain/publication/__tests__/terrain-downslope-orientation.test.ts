/**
 * ADR-920 Β4.9 — αζιμούθιο κατωφέρειας → ένας από τους οκτώ προσανατολισμούς του ενός λεξιλογίου.
 *
 *   Π1  τα κέντρα των τομέων · Π2  τα όρια ανήκουν στον ΕΠΟΜΕΝΟ τομέα (κάθε γωνία ακριβώς έναν)
 *   Π3  εκτός [0, 360) τυλίγεται · Π4  επίπεδο / μη πεπερασμένο ⇒ καμία διεύθυνση
 */

import { downslopeOrientationOf } from '../terrain-downslope-orientation';

describe('downslopeOrientationOf', () => {
  it.each([
    [0, 'north'], [45, 'northeast'], [90, 'east'], [135, 'southeast'],
    [180, 'south'], [225, 'southwest'], [270, 'west'], [315, 'northwest'],
  ] as const)('Π1 %s° ⇒ %s', (azimuth, orientation) => {
    expect(downslopeOrientationOf(azimuth)).toBe(orientation);
  });

  it('Π2 τα όρια ανήκουν στον επόμενο τομέα κατά τη φορά του ρολογιού', () => {
    expect(downslopeOrientationOf(22.4999)).toBe('north');
    expect(downslopeOrientationOf(22.5)).toBe('northeast');
    expect(downslopeOrientationOf(337.4999)).toBe('northwest');
    expect(downslopeOrientationOf(337.5)).toBe('north');
  });

  it('Π3 εκτός [0, 360) τυλίγεται', () => {
    expect(downslopeOrientationOf(360)).toBe('north');
    expect(downslopeOrientationOf(-90)).toBe('west');
    expect(downslopeOrientationOf(540)).toBe('south');
  });

  it('Π4 επίπεδο ή μη πεπερασμένο ⇒ null', () => {
    expect(downslopeOrientationOf(null)).toBeNull();
    expect(downslopeOrientationOf(Number.NaN)).toBeNull();
    expect(downslopeOrientationOf(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
