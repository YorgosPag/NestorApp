/**
 * @fileoverview ADR-840 §7.7 — το δίχτυ `[...unprefixed]` κουβαλά ερώτημα **και** fragment ακέραια.
 *
 * 🔴 Μετρημένο ζωντανά (2026-10-15): `/properties?view=floorplan#frag` ⇒ `/o/<χώρος>/properties?view=floorplan`
 *    — το fragment χανόταν, γιατί το `redirect()` κάτω από το `(app)/loading.tsx` απαντά 200 και το εκτελεί ο πελάτης.
 */

import { arrivalQuery, withFragment } from '../arrival-address';

describe('arrivalQuery', () => {
  it('κενό ⇒ κενό (ποτέ σκέτο `?`)', () => {
    expect(arrivalQuery({})).toBe('');
    expect(arrivalQuery({ a: undefined })).toBe('');
  });

  it('κρατά κάθε κλειδί, και όλες τις πολλαπλές τιμές με τη σειρά τους', () => {
    expect(arrivalQuery({ view: 'floorplan', selected: 'p1', tag: ['x', 'y'] })).toBe(
      '?view=floorplan&selected=p1&tag=x&tag=y',
    );
  });

  it('κωδικοποιεί σωστά τιμές με ειδικούς χαρακτήρες', () => {
    expect(new URLSearchParams(arrivalQuery({ filter: 'Δοκιμή & co' }).slice(1)).get('filter')).toBe('Δοκιμή & co');
  });
});

describe('withFragment', () => {
  it('προσθέτει το fragment του αιτήματος', () => {
    expect(withFragment('/o/ws/properties?view=floorplan', '#frag')).toBe('/o/ws/properties?view=floorplan#frag');
    expect(withFragment('/o/ws/network', 'thread-1')).toBe('/o/ws/network#thread-1');
  });

  it('κενό ή σκέτο `#` ⇒ ο προορισμός αυτούσιος', () => {
    expect(withFragment('/o/ws/properties', '')).toBe('/o/ws/properties');
    expect(withFragment('/o/ws/properties', '#')).toBe('/o/ws/properties');
  });

  it('το fragment του ΠΡΟΟΡΙΣΜΟΥ κερδίζει (κανόνας του browser σε 3xx)', () => {
    expect(withFragment('/o/ws/a#own', '#req')).toBe('/o/ws/a#own');
  });
});
