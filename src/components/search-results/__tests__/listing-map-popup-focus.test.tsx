/**
 * @fileoverview ΑΓΚΥΡΑ — **η φούσκα παίρνει την εστίαση, ΧΩΡΙΣ να κυλήσει τη σελίδα** (ADR-777 §8.77).
 * @related components/search-results/ListingMapPopupFrame.tsx · lib/a11y/focus-first.ts
 *
 * Μετρημένο ζωντανά: το `focus()` της MapLibre (`focusAfterOpen`) πέταξε τη σελίδα από 649 σε 0, επειδή
 * ο χάρτης ζει σε sticky πάνελ. Η άγκυρα ρωτά τα δύο μισά της θεραπείας:
 *   Ε1 · η MapLibre ΔΕΝ εστιάζει (`focusAfterOpen: false`) — αλλιώς η κύλιση επιστρέφει.
 *   Ε2 · στο `open` εστιάζεται το ΠΡΩΤΟ εστιάσιμο της φούσκας, με `preventScroll: true` — η a11y μένει.
 *
 * @jest-environment jsdom
 */

import React from 'react';
import { act, render } from '@testing-library/react';

interface CapturedPopupProps {
  readonly focusAfterOpen?: boolean;
  readonly onOpen?: (event: { type: 'open'; target: { getElement(): HTMLElement } }) => void;
}

let captured: CapturedPopupProps = {};

jest.mock('@/lib/maps/maplibre', () => ({
  Popup: (props: CapturedPopupProps & { children: React.ReactNode }) => {
    captured = props;
    return <div data-testid="popup">{props.children}</div>;
  },
}));

import { ListingMapPopupFrame } from '../ListingMapPopupFrame';

describe('ListingMapPopupFrame — εστίαση χωρίς κύλιση', () => {
  it('Ε1+Ε2 · η MapLibre δεν εστιάζει· εμείς εστιάζουμε το πρώτο στοιχείο με `preventScroll`', () => {
    const calls: Array<{ el: string; options: FocusOptions | undefined }> = [];
    const original = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function focus(this: HTMLElement, options?: FocusOptions) {
      calls.push({ el: this.textContent ?? '', options });
      original.call(this, options);
    };
    try {
      const { getByTestId } = render(
        <ListingMapPopupFrame point={{ lat: 40.64, lng: 22.94 }} onClose={() => undefined}>
          <p>τίτλος</p>
          <a href="/offers/x">Άνοιγμα</a>
          <button type="button">δεύτερο</button>
        </ListingMapPopupFrame>,
      );

      expect(captured.focusAfterOpen).toBe(false);

      const popupElement = getByTestId('popup');
      act(() => captured.onOpen?.({ type: 'open', target: { getElement: () => popupElement } }));

      expect(calls).toEqual([{ el: 'Άνοιγμα', options: { preventScroll: true } }]);
      expect(document.activeElement?.textContent).toBe('Άνοιγμα');
    } finally {
      HTMLElement.prototype.focus = original;
    }
  });
});
