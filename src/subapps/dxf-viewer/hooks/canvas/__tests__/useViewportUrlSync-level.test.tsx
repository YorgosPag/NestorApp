/**
 * ADR-400 · ADR-914 §8.14 — **η διεύθυνση θυμάται το ανοιχτό επίπεδο και σε άδειο, ακίνητο καμβά.**
 *
 * Μετρημένο σε Chrome 2026-10-11: από κενό πρόχειρο, «Κάτοψη για…» σε όροφο χωρίς υπόβαθρο ⇒ το
 * `?bldg=` άλλαξε, το `lvl=` έμεινε του πρόχειρου, και F5 άνοιγε το προηγούμενο επίπεδο. Ρίζα: το
 * `lvl` γραφόταν μόνο μαζί με τον μετασχηματισμό, και ο ουδέτερος μετασχηματισμός δεν γράφεται ποτέ.
 *
 * Εκτελείται το πραγματικό hook πάνω στο πραγματικό `viewport-persistence` και στο πραγματικό
 * `ImmediateTransformStore` (που ξεκινά ουδέτερο — ακριβώς ο άδειος καμβάς του περιστατικού).
 */

import { renderHook } from '@testing-library/react';
import { useViewportUrlSync } from '../useViewportUrlSync';

const search = () => new URLSearchParams(window.location.search);

function mount(levelId: string | null) {
  return renderHook(
    ({ id }: { id: string | null }) => useViewportUrlSync({ fileRecordId: null, levelId: id }),
    { initialProps: { id: levelId } },
  );
}

beforeEach(() => {
  window.history.replaceState({}, '', '/dxf/viewer');
});

describe('αλλαγή επιπέδου σε άδειο, ακίνητο καμβά', () => {
  it('🔑 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ — το `lvl` ακολουθεί το ανοιχτό επίπεδο', () => {
    window.history.replaceState({}, '', '/dxf/viewer?lvl=lvl_draft');
    const { rerender } = mount('lvl_draft');

    rerender({ id: 'lvl_storey' });

    expect(search().get('lvl')).toBe('lvl_storey');
  });

  it('γράφει ΜΟΝΟ το `lvl` — ο ουδέτερος μετασχηματισμός δεν μπαίνει στη διεύθυνση', () => {
    const { rerender } = mount('lvl_a');

    rerender({ id: 'lvl_b' });

    const params = search();
    expect(params.get('lvl')).toBe('lvl_b');
    expect(params.has('s')).toBe(false);
    expect(params.has('ox')).toBe(false);
    expect(params.has('oy')).toBe(false);
  });

  it('δεν αγγίζει μετασχηματισμό που περιμένει επαναφορά (F5 πάνω σε σύνδεσμο με κάμερα)', () => {
    window.history.replaceState({}, '', '/dxf/viewer?s=2&ox=10&oy=20&lvl=lvl_a&bldg=bldg_1');

    mount('lvl_a');

    const params = search();
    expect(params.get('s')).toBe('2');
    expect(params.get('ox')).toBe('10');
    expect(params.get('oy')).toBe('20');
    expect(params.get('bldg')).toBe('bldg_1');
  });

  it('χωρίς ανοιχτό επίπεδο (bootstrap) ο σύνδεσμος ΔΕΝ σβήνεται', () => {
    window.history.replaceState({}, '', '/dxf/viewer?lvl=lvl_shared');

    mount(null);

    expect(search().get('lvl')).toBe('lvl_shared');
  });
});
