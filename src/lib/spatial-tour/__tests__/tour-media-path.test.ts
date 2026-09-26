/**
 * @jest-environment node
 *
 * @fileoverview **Η ΔΙΑΔΡΟΜΗ ΤΩΝ ΜΕΣΩΝ ΔΕΝ ΒΓΑΙΝΕΙ ΠΟΤΕ ΑΠΟ ΤΗΝ ΠΕΡΙΗΓΗΣΗ** (ADR-884 Κ3β) — άγκυρες λίστας επιτρεπτών.
 */

import { tourMediaObjectPath } from '../tour-media-path';

describe('tourMediaObjectPath', () => {
  it('έγκυρα τμήματα ⇒ αντικείμενο κάτω από tour-tiles/{tourId}/', () => {
    expect(tourMediaObjectPath('stour_a', ['tcap_1', 'h1', '2', 'f_0_1.jpg'])).toBe('tour-tiles/stour_a/tcap_1/h1/2/f_0_1.jpg');
  });

  it.each([
    [['..', 'secret']],
    [['.', 'x']],
    [['a', '..']],
    [['.hidden']],
    [['a/b']],
    [['a\\b']],
    [['%2e%2e']],
    [['a b']],
    [['a\u0000b']],
    [[]],
    [Array.from({ length: 9 }, () => 'x')],
    [['x'.repeat(129)]],
  ])('απορρίπτει %j', (segments) => {
    expect(tourMediaObjectPath('stour_a', segments)).toBeNull();
  });

  it('άκυρο tourId ⇒ τίποτα (αμυντικά — παράγεται, αλλά ποτέ εμπιστοσύνη)', () => {
    expect(tourMediaObjectPath('../x', ['a'])).toBeNull();
  });
});
