/**
 * ADR-915 §45.20 — ο ΕΝΑΣ κατασκευαστής συνδέσμου εξωτερικών χαρτών: τεκμηριωμένη μορφή Google Maps URLs (`api=1`,
 * `/search/` ΜΕ κάθετο), κωδικοποίηση, και `null` αντί για σύνδεσμο που δεν ψάχνει τίποτα.
 */

import { externalMapSearchUrl } from '@/lib/geo/external-map-link';

describe('externalMapSearchUrl', () => {
  it('διεύθυνση ⇒ /maps/search/?api=1&query=… κωδικοποιημένη', () => {
    const url = externalMapSearchUrl({ kind: 'address', address: '  Αγίου Ανδρέου 60, Πάτρα  ' });
    expect(url).not.toBeNull();
    const parsed = new URL(url ?? '');
    expect(`${parsed.origin}${parsed.pathname}`).toBe('https://www.google.com/maps/search/');
    expect(parsed.searchParams.get('api')).toBe('1');
    expect(parsed.searchParams.get('query')).toBe('Αγίου Ανδρέου 60, Πάτρα');
  });

  it('σημείο ⇒ «lat,lng»', () => {
    const url = externalMapSearchUrl({ kind: 'point', lat: 38.246, lng: 21.735 });
    expect(new URL(url ?? '').searchParams.get('query')).toBe('38.246,21.735');
  });

  it('χαρακτήρες που σπάνε URL (#, &) δεν κόβουν το ερώτημα', () => {
    const url = externalMapSearchUrl({ kind: 'address', address: 'Οδός Α & Β #3' });
    expect(new URL(url ?? '').searchParams.get('query')).toBe('Οδός Α & Β #3');
  });

  it.each([
    [{ kind: 'address', address: '   ' } as const],
    [{ kind: 'point', lat: Number.NaN, lng: 21 } as const],
    [{ kind: 'point', lat: 38, lng: Number.POSITIVE_INFINITY } as const],
  ])('τίποτα να αναζητηθεί ⇒ null', (target) => {
    expect(externalMapSearchUrl(target)).toBeNull();
  });
});
