/**
 * @jest-environment jsdom
 *
 * ADR-241 · ADR-364 §10.15.γ · ADR-711 — **Η πλήρης οθόνη συμπεριφέρεται ως επιφάνεια.**
 *
 * 🔴 Μετρημένο ζωντανά 2026-09-11 (Chrome, 4 καταναλωτές + DXF): ένα Esc με ανοιχτό Select / μενού / διάλογο μέσα στην
 * πλήρη οθόνη έκλεινε **και** τη στρώση **και** την πλήρη οθόνη· το Tab δραπέτευε στη σελίδα από κάτω· στην έξοδο το
 * focus έπεφτε στο `body`.
 *
 *  A6 — Esc με ανοιχτή στρώση Radix ⇒ κλείνει ΜΟΝΟ η στρώση· το επόμενο Esc ⇒ έξοδος.
 *  A7 — Esc σε πεδίο κειμένου ⇒ το focus φεύγει από το πεδίο προς την επιφάνεια (κείμενο ίδιο)· το επόμενο ⇒ έξοδος.
 *  C1′ — όσο είναι ενεργή, ό,τι είναι έξω της είναι `inert`· μετά, όχι.
 *  C2 — είσοδος ⇒ focus μέσα στην επιφάνεια· έξοδος ⇒ focus πίσω στο κουμπί που την άνοιξε.
 *  C4 — δεν πατά modal keyboard scope (θα σκότωνε τους accelerators του DXF).
 *  Σ  — κλείδωμα κύλισης του `body` όσο είναι ενεργή.
 *
 * ⚠️ ΤΙ ΔΕΝ ΒΛΕΠΕΙ ΤΟ JSDOM: τη διαδοχική πλοήγηση Tab (το `inert` εδώ κρίνεται ως γνώρισμα) και το `moveBefore`
 * (εδώ ο ξενιστής μετακινείται με `appendChild`, άρα το focus χάνεται στη μετακίνηση — η πιο δύσκολη περίπτωση).
 */

import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { FullscreenOverlay } from '@/core/containers/FullscreenOverlay';
import { useFullscreen } from '@/hooks/useFullscreen';
import { __resetEscapeLayersForTests } from '@/lib/a11y/escape-layers';
import { isModalKeyboardScopeActive } from '@/lib/a11y/keyboard-scope';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface HarnessProps {
  readonly startFullscreen?: boolean;
  readonly withMenu?: boolean;
  readonly withDialog?: boolean;
}

function Harness({ startFullscreen = false, withMenu = false, withDialog = false }: HarnessProps): React.ReactElement {
  const fs = useFullscreen({ defaultFullscreen: startFullscreen });
  const [menuOpen, setMenuOpen] = useState(withMenu);
  const [dialogOpen, setDialogOpen] = useState(withDialog);
  return (
    <>
      <nav data-testid="outside">έξω</nav>
      <FullscreenOverlay isFullscreen={fs.isFullscreen} onToggle={fs.toggle} ariaLabel="Δοκιμή">
        <button type="button" onClick={fs.toggle}>εναλλαγή</button>
        <input aria-label="πεδίο" defaultValue="Ανάθεση" />
        {withMenu && (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger>μενού</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {withDialog && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogTitle>διάλογος</DialogTitle>
            </DialogContent>
          </Dialog>
        )}
      </FullscreenOverlay>
      <output data-testid="state">{`${fs.isFullscreen ? 'fs' : 'inline'}|${menuOpen ? 'menu' : ''}|${dialogOpen ? 'dialog' : ''}`}</output>
    </>
  );
}

const surfaceOf = (): HTMLElement | null => document.querySelector('[data-fullscreen-surface]');
const stateOf = (): string => screen.getByTestId('state').textContent ?? '';

function pressEscape(): void {
  const target = document.activeElement ?? document.body;
  act(() => {
    fireEvent.keyDown(target, { key: 'Escape' });
  });
}

afterEach(() => {
  __resetEscapeLayersForTests();
  document.body.classList.remove('overflow-hidden');
});

describe('A6 — ένα Esc = ένα πλαίσιο: η στρώση Radix πρώτα', () => {
  test('ανοιχτό μενού ⇒ Esc#1 κλείνει μόνο το μενού, Esc#2 βγάζει από την πλήρη οθόνη', () => {
    render(<Harness startFullscreen withMenu />);
    expect(stateOf()).toBe('fs|menu|');
    pressEscape();
    expect(stateOf()).toBe('fs||');
    pressEscape();
    expect(stateOf()).toBe('inline||');
  });

  test('ανοιχτός διάλογος ⇒ Esc#1 κλείνει μόνο τον διάλογο', () => {
    render(<Harness startFullscreen withDialog />);
    pressEscape();
    expect(stateOf()).toBe('fs||');
  });
});

describe('A7 — πεδίο κειμένου: πρώτα έξω από το πεδίο, μετά έξω από την πλήρη οθόνη', () => {
  test('Esc#1 στο πεδίο ⇒ focus στην επιφάνεια, τιμή ίδια, πλήρης οθόνη ΜΕΝΕΙ · Esc#2 ⇒ έξοδος', () => {
    render(<Harness startFullscreen />);
    const field = screen.getByLabelText('πεδίο') as HTMLInputElement;
    act(() => field.focus());
    pressEscape();
    expect(stateOf()).toBe('fs||');
    expect(document.activeElement).toBe(surfaceOf());
    expect(field.value).toBe('Ανάθεση');
    pressEscape();
    expect(stateOf()).toBe('inline||');
  });
});

describe('C1′ — αδράνεια έξω από την επιφάνεια', () => {
  test('ενεργή ⇒ ό,τι είναι έξω `inert` · έξοδος ⇒ όχι', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('εναλλαγή'));
    expect(screen.getByTestId('outside').closest('[inert]')).not.toBeNull();
    expect(surfaceOf()?.closest('[inert]')).toBeNull();
    pressEscape();
    expect(screen.getByTestId('outside').closest('[inert]')).toBeNull();
  });
});

describe('C2 — focus μέσα στην είσοδο, πίσω στην έξοδο', () => {
  test('το κουμπί που άνοιξε την πλήρη οθόνη ξαναπαίρνει το focus', async () => {
    render(<Harness />);
    const toggle = screen.getByText('εναλλαγή');
    act(() => toggle.focus());
    fireEvent.click(toggle);
    expect(surfaceOf()?.contains(document.activeElement)).toBe(true);
    act(() => surfaceOf()?.focus());
    pressEscape();
    await waitFor(() => expect(document.activeElement).toBe(toggle));
  });
});

describe('C4 + Σ — τι ΔΕΝ κάνει και τι κάνει όσο είναι ενεργή', () => {
  test('δεν πατά modal keyboard scope · κλειδώνει την κύλιση του body', () => {
    render(<Harness startFullscreen />);
    expect(isModalKeyboardScopeActive()).toBe(false);
    expect(document.body.classList.contains('overflow-hidden')).toBe(true);
    pressEscape();
    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
  });
});
