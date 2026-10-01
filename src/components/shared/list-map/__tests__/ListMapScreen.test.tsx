/**
 * 🔴 **ΑΓΚΥΡΑ ΤΟΥ ΣΧΗΜΑΤΟΣ «ΟΘΟΝΗ»** — ADR-777 §8.84 · ADR-896 §4.5.
 *
 * Το `ListMapScreen` υπόσχεται ότι η γεωμετρία είναι **μόνο CSS** (CLS = 0 εκ κατασκευής). Αυτό
 * ελέγχεται εδώ ως «η ίδια συμβολοσειρά κλάσεων για `measuring` / `narrow` / `wide`»: αν κάποτε
 * μια κλάση εξαρτηθεί από τη μέτρηση, η αναδιάταξη μετά την ενυδάτωση επιστρέφει — και αυτή η
 * σουίτα κοκκινίζει.
 *
 * ⚠️ Το jsdom δεν έχει διάταξη: εδώ αποδεικνύεται η **απόφαση** (ποιες κλάσεις, ποια σειρά), όχι η
 * φυσική — εκείνη ελέγχεται στο ζωντανό περπάτημα.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import type { ViewportClass } from '@/hooks/media/useViewportClass';

import { ListMapScreen } from '../ListMapScreen';
import { LIST_MAP_SCREEN_FRAME, LIST_MAP_SCREEN_MAP_PANE } from '../list-map-layout';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/hooks/useIconSizes', () => ({
  useIconSizes: () => ({ sm: 'h-4 w-4' }),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

const VIEWPORTS: readonly ViewportClass[] = ['measuring', 'narrow', 'wide'];

function mount(viewport: ViewportClass) {
  const view = render(
    <ListMapScreen
      viewport={viewport}
      mapLabel="Χάρτης"
      list={<div data-list-scroll data-testid="list" />}
      map={<div data-testid="map" />}
    />
  );
  const frame = view.container.querySelector<HTMLElement>('[data-list-map-presentation="screen"]');
  if (!frame) throw new Error('Το κάδρο της οθόνης δεν αποδόθηκε.');
  return { ...view, frame };
}

/** Το «σχήμα» = κάθε `class` του υποδέντρου, με τη σειρά του DOM. */
function geometryOf(frame: HTMLElement): readonly string[] {
  return [frame, ...frame.querySelectorAll<HTMLElement>('*')].map((node) => node.getAttribute('class') ?? '');
}

describe('ListMapScreen — η γεωμετρία ΔΕΝ περιμένει τη μέτρηση', () => {
  it('Σ1: ίδιες κλάσεις σε ΟΛΟ το υποδέντρο για measuring / narrow / wide (CLS 0)', () => {
    const shapes = VIEWPORTS.map((viewport) => {
      const { frame, unmount } = mount(viewport);
      const shape = geometryOf(frame);
      unmount();
      return shape;
    });
    expect(shapes[1]).toEqual(shapes[0]);
    expect(shapes[2]).toEqual(shapes[0]);
  });

  it('Σ2: το κάδρο και το πάνελ χάρτη έρχονται ΑΠΟ ΤΗΝ ΑΥΘΕΝΤΙΑ', () => {
    const { frame } = mount('wide');
    expect(frame).toHaveClass(...LIST_MAP_SCREEN_FRAME.split(' '));
    const pane = screen.getByRole('region', { name: 'Χάρτης' });
    expect(pane).toHaveClass(...LIST_MAP_SCREEN_MAP_PANE.split(' '));
    // Ο ξένος κώδικας του χάρτη δεν αναρριχάται πάνω από το φύλλο (CHECK 3.50).
    expect(pane).toHaveClass('isolate');
    expect(pane).toContainElement(screen.getByTestId('map'));
  });

  it('Σ3: η λίστα είναι ΠΡΩΤΗ στη σειρά ανάγνωσης, μέσα στο φύλλο (SPEC-777D §25.3)', () => {
    const { frame } = mount('narrow');
    const [sheet, pane] = Array.from(frame.children);
    expect(sheet).toHaveAttribute('data-sheet-state');
    expect(sheet).toContainElement(screen.getByTestId('list'));
    expect(pane).toBe(screen.getByRole('region', { name: 'Χάρτης' }));
  });
});
