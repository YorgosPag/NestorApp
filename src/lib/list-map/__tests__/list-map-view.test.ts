/**
 * @fileoverview Η προβολή λίστα ‖ χάρτης στο URL — μεταφέρθηκε αυτούσια από το
 * `owner-portfolio-map.test.ts` (Κ5) μαζί με την εξαγωγή του κώδικα (ADR-896).
 */

import { parseListMapView, writeListMapView } from '../list-map-view';

describe('η προβολή στο URL', () => {
  it.each([
    ['', 'list'],
    ['view=map', 'map'],
    ['view=list', 'list'],
    ['view=satellite', 'list'],
  ])('«%s» ⇒ %s', (query, expected) => {
    expect(parseListMapView(new URLSearchParams(query))).toBe(expected);
  });

  it('η γραφή κρατά τα άσχετα κλειδιά· η λίστα σβήνει το κλειδί', () => {
    const params = new URLSearchParams('tab=x');
    writeListMapView('map', params);
    expect(params.toString()).toBe('tab=x&view=map');
    writeListMapView('list', params);
    expect(params.toString()).toBe('tab=x');
  });
});
