/**
 * ADR-937 Φάση 0 — αζιμούθιο ⇄ ένας από τους οκτώ προσανατολισμούς του ενός λεξιλογίου.
 *
 *   Π1  κέντρα τομέων · Π2  όρια στον ΕΠΟΜΕΝΟ τομέα · Π3  τύλιγμα · Π4  μη πεπερασμένο ⇒ null · Π5  αντίστροφο ταυτίζεται
 */

import { ORIENTATIONS } from '@/constants/property-features-enterprise';

import { azimuthOfOrientation, orientationOfAzimuth } from '../azimuth-orientation';

describe('orientationOfAzimuth', () => {
  it.each([
    [0, 'north'], [45, 'northeast'], [90, 'east'], [135, 'southeast'],
    [180, 'south'], [225, 'southwest'], [270, 'west'], [315, 'northwest'],
  ] as const)('Π1 %s° ⇒ %s', (azimuth, orientation) => {
    expect(orientationOfAzimuth(azimuth)).toBe(orientation);
  });

  it('Π2 τα όρια ανήκουν στον επόμενο τομέα κατά τη φορά του ρολογιού', () => {
    expect(orientationOfAzimuth(22.4999)).toBe('north');
    expect(orientationOfAzimuth(22.5)).toBe('northeast');
    expect(orientationOfAzimuth(337.4999)).toBe('northwest');
    expect(orientationOfAzimuth(337.5)).toBe('north');
  });

  it('Π3 εκτός [0, 360) τυλίγεται', () => {
    expect(orientationOfAzimuth(-90)).toBe('west');
    expect(orientationOfAzimuth(450)).toBe('east');
  });

  it('Π4 μη πεπερασμένο ή null ⇒ null', () => {
    expect(orientationOfAzimuth(null)).toBeNull();
    expect(orientationOfAzimuth(Number.NaN)).toBeNull();
  });
});

describe('azimuthOfOrientation', () => {
  it('Π5 το αντίστροφο επιστρέφει στον ίδιο τομέα για ΚΑΘΕ τιμή του λεξιλογίου', () => {
    for (const orientation of ORIENTATIONS) {
      expect(orientationOfAzimuth(azimuthOfOrientation(orientation))).toBe(orientation);
    }
  });
});
