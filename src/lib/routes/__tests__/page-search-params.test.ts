/**
 * @jest-environment node
 *
 * `searchParams` σελίδας → `URLSearchParams` (ADR-900 §3.7) — το σχήμα που διαβάζουν οι parsers του έργου.
 */

import { urlSearchParamsOf } from '../page-search-params';

describe('urlSearchParamsOf', () => {
  it('κρατά τις μονές τιμές αυτούσιες', () => {
    const params = urlSearchParamsOf({ address: 'Εγνατίας 147', type: 'apartment' });
    expect(params.get('address')).toBe('Εγνατίας 147');
    expect(params.get('type')).toBe('apartment');
  });

  it('πίνακας ⇒ παραλείπεται (δύο τιμές για ένα πεδίο δεν είναι τιμή)', () => {
    expect(urlSearchParamsOf({ type: ['a', 'b'] }).has('type')).toBe(false);
  });

  it('`undefined` ⇒ απουσία, όχι «undefined»', () => {
    expect(urlSearchParamsOf({ floor: undefined }).has('floor')).toBe(false);
  });
});
