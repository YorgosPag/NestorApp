/**
 * @fileoverview ADR-840 §7.7 — το SSoT «κλειστό σύνολο τιμών + προεπιλογή που σβήνει το κλειδί».
 */

import { urlEnumParam } from '../enum-param';

const SHAPE = urlEnumParam({ param: 'shape', values: ['circle', 'square'] as const, fallback: 'circle' });

describe('urlEnumParam', () => {
  it.each([
    ['', 'circle'],
    ['shape=square', 'square'],
    ['shape=circle', 'circle'],
    ['shape=hexagon', 'circle'],
  ])('«%s» ⇒ %s', (query, expected) => {
    expect(SHAPE.parse(new URLSearchParams(query))).toBe(expected);
  });

  it('η γραφή κρατά τα άσχετα κλειδιά· η προεπιλογή σβήνει το κλειδί', () => {
    const params = new URLSearchParams('tab=x');
    SHAPE.write('square', params);
    expect(params.toString()).toBe('tab=x&shape=square');
    SHAPE.write('circle', params);
    expect(params.toString()).toBe('tab=x');
  });

  it('`is` δέχεται μόνο το κλειστό σύνολο', () => {
    expect(SHAPE.is('square')).toBe(true);
    expect(SHAPE.is('hexagon')).toBe(false);
    expect(SHAPE.is(null)).toBe(false);
  });
});
