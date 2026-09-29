/**
 * Άγκυρες του **φόντου κάθε χάρτη χωρίς διακόπτη** (ADR-891 Φ4).
 *
 * 🔑 Η ερώτηση δεν είναι «κλήθηκε το `protomapsStyle`;» αλλά **τι ζητά ο χάρτης από το δίκτυο**: κάθε URL του
 * στυλ πρέπει να δείχνει στον δικό μας διακομιστή, και η εφεδρεία να ανάβει **μόνο** όταν πέσει εκείνος.
 */

import { act, renderHook } from '@testing-library/react';
import type { StyleSpecification } from 'maplibre-gl';

jest.mock('../use-basemap-scheme', () => ({ useBasemapScheme: () => 'light' }));

import { BASEMAP_FALLBACK_SOURCE_ID, DEFAULT_BASEMAP_SOURCE_ID, basemapProviderOfHost, basemapStyle, unwrapArchiveUrl } from '../basemap-catalog';
import { isBasemapSourceFailure, useDefaultBasemap, type MapErrorEvent } from '../use-default-basemap';

function errorEvent(detail: Record<string, unknown>): MapErrorEvent {
  return { type: 'error', error: new Error('boom'), ...detail } as unknown as MapErrorEvent;
}

/** Κάθε διεύθυνση δικτύου που γράφει ένα στυλ: πηγές, glyphs, sprite. */
function styleUrls(style: StyleSpecification): string[] {
  const sourceUrls = Object.values(style.sources).flatMap((source) => {
    const urls: string[] = [];
    if ('url' in source && typeof source.url === 'string') urls.push(unwrapArchiveUrl(source.url));
    if ('tiles' in source && Array.isArray(source.tiles)) urls.push(...source.tiles);
    return urls;
  });
  const sprite = typeof style.sprite === 'string' ? [style.sprite] : [];
  return [...sourceUrls, ...(style.glyphs === undefined ? [] : [style.glyphs]), ...sprite];
}

describe('Α — ο χάρτης ΑΝΟΙΓΕΙ στον δικό μας διακομιστή', () => {
  it('κάθε URL του στυλ ανήκει στον πάροχο `nestor` — κανένα αίτημα σε τρίτο', () => {
    const { result } = renderHook(() => useDefaultBasemap());
    const { mapStyle } = result.current;
    if (typeof mapStyle === 'string') throw new Error('αναμενόταν στυλ, όχι URL τρίτου');
    const urls = styleUrls(mapStyle);
    expect(urls.length).toBeGreaterThanOrEqual(3);
    for (const url of urls) expect(basemapProviderOfHost(new URL(url.replace('{fontstack}', 'f').replace('{range}', 'r')).hostname)?.id).toBe('nestor');
  });

  it('ίδιο θέμα ⇒ ΙΔΙΟ αντικείμενο στυλ (κανένα «νέο στυλ» σε κάθε render)', () => {
    const { result, rerender } = renderHook(() => useDefaultBasemap());
    const first = result.current.mapStyle;
    rerender();
    expect(result.current.mapStyle).toBe(first);
  });
});

describe('Β — εφεδρεία ΑΠΟ ΤΟ ΓΕΓΟΝΟΣ: μόνο όταν πέσει η πηγή φόντου', () => {
  it.each([
    ['σφάλμα της πηγής φόντου χωρίς πλακίδιο', { sourceId: DEFAULT_BASEMAP_SOURCE_ID }, true],
    ['σφάλμα ΕΝΟΣ πλακιδίου του φόντου', { sourceId: DEFAULT_BASEMAP_SOURCE_ID, tile: {} }, false],
    ['σφάλμα στρώσης του καταναλωτή', { sourceId: 'place-shape' }, false],
    ['σφάλμα χωρίς πηγή (π.χ. sprite)', {}, false],
  ])('%s ⇒ %s', (_label, detail, expected) => {
    expect(isBasemapSourceFailure(errorEvent(detail))).toBe(expected);
  });

  it('πέφτει ο διακομιστής ⇒ το φόντο γίνεται η δηλωμένη εφεδρεία, και ΜΕΝΕΙ', () => {
    const { result } = renderHook(() => useDefaultBasemap());
    act(() => result.current.onError(errorEvent({ sourceId: 'place-shape' })));
    expect(typeof result.current.mapStyle).toBe('object');

    act(() => result.current.onError(errorEvent({ sourceId: DEFAULT_BASEMAP_SOURCE_ID })));
    expect(result.current.mapStyle).toBe(basemapStyle(BASEMAP_FALLBACK_SOURCE_ID));
  });
});
