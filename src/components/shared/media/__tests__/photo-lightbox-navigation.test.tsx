/**
 * @fileoverview **Πλοήγηση του lightbox: στάση στο άκρο, εστίαση που ΔΕΝ χάνεται** (ADR-899 §9 · θέμα 4).
 *
 * Μετρημένο ζωντανά: Enter ×3 στο «Επόμενη» από 1/4 **κόλλησε στο 2/4** — το `key` στη σκηνή ξανάστηνε τα κουμπιά
 * και η εστίαση έπεφτε σε `DIV`. Μεταλλάξεις που πρέπει να πιάσει:
 * - Ν1: η σκηνή ξαναστήνεται ανά φωτογραφία (χάνεται ο εστιασμένος κόμβος / η live region).
 * - Ν2: το κουμπί στο άκρο γίνεται `disabled` (πετά την εστίαση) αντί για `aria-disabled`.
 * - Ν3: το βήμα στο άκρο κάνει λούπα.
 */

import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { PhotoLightbox, type LightboxPhoto } from '../PhotoLightbox';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${params.index}/${params.total}` : key) }),
}));

const PHOTOS: LightboxPhoto[] = [1, 2, 3].map((n) => ({ key: `k${n}`, src: `/p${n}.webp`, alt: `photo ${n}` }));
const NEXT = 'listing-detail:media.capture.next';
const PREVIOUS = 'listing-detail:media.capture.previous';

function Harness({ start }: { readonly start: number }) {
  const [index, setIndex] = useState<number | null>(start);
  return <PhotoLightbox photos={PHOTOS} floorplans={[]} openIndex={index} onNavigate={setIndex} />;
}

const counter = () => document.querySelector('output');

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;
});

describe('PhotoLightbox — πλοήγηση', () => {
  it('🔴 Ν1 το βήμα κρατά την εστίαση στον ΙΔΙΟ κόμβο και την ίδια live region', () => {
    render(<Harness start={0} />);
    const next = screen.getByRole('button', { name: NEXT });
    const region = counter();
    next.focus();

    fireEvent.click(next);
    fireEvent.click(screen.getByRole('button', { name: NEXT }));

    expect(screen.getByAltText('photo 3')).toBeTruthy();
    expect(screen.getByRole('button', { name: NEXT })).toBe(next);
    expect(document.activeElement).toBe(next);
    expect(counter()).toBe(region);
    expect(region?.textContent).toBe('listing-detail:media.capture.counter:3/3');
  });

  it('🔴 Ν2 στο άκρο: aria-disabled, ΟΧΙ disabled — το κουμπί μένει εστιάσιμο', () => {
    render(<Harness start={2} />);
    const next = screen.getByRole('button', { name: NEXT });

    expect(next.getAttribute('aria-disabled')).toBe('true');
    expect(next.hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: PREVIOUS }).getAttribute('aria-disabled')).toBeNull();
  });

  it('🔴 Ν3 στάση στο άκρο σε κουμπί ΚΑΙ πληκτρολόγιο', () => {
    render(<Harness start={2} />);
    fireEvent.click(screen.getByRole('button', { name: NEXT }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });
    expect(screen.getByAltText('photo 3')).toBeTruthy();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowLeft' });
    expect(screen.getByAltText('photo 2')).toBeTruthy();
  });
});
