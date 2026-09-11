/**
 * @jest-environment jsdom
 *
 * ΣΥΜΒΟΛΑΙΟ ΣΤΡΩΣΕΩΝ — ADR-780 Φάση Δ (γεννήθηκε από το εύρημα Ζ3 του ADR-332 D27).
 *
 * ## Το περιστατικό
 * Σε πλήρη οθόνη ο διάλογος συρσίματος πινέζας ήταν **αόρατος** και το πρώτο κλικ τον **ακύρωνε**:
 * το `FullscreenOverlay` δήλωνε ωμό `z-[60]` και όλη η οικογένεια Radix ωμό `z-50`, οπότε ο διάλογος
 * ζωγραφιζόταν ΚΑΤΩ από την επιφάνεια που τον άνοιξε. Το Radix βάζει `pointer-events:none` στο `body`,
 * άρα το πρώτο κλικ του ανθρώπου ήταν «κλικ έξω» ⇒ Ακύρωση. Καμία πύλη δεν το είδε, γιατί η CHECK 3.50
 * κρίνει «καθολικό;» από τον ΑΡΙΘΜΟ (≥1000) — και κανένα test δεν ρωτούσε ποιος κάθεται πάνω από ποιον.
 *
 * ## Τι κλειδώνει εδώ (από τα ΠΡΑΓΜΑΤΙΚΑ components, ανοιχτά, όχι από σταθερές)
 *  Σ1 — όλη η παροδική οικογένεια δηλώνει ΕΝΑΝ ρόλο (`transientStack`): μέσα της νικά το πιο πρόσφατα
 *       ανοιγμένο (σειρά portal) — ο κανόνας του top layer του browser («last in, on top», MDN), της MUI
 *       (Popover/Menu πατούν στο Modal) και του shadcn. Σκαλιά κατά είδος θα έβαζαν διάλογο ΠΙΣΩ από το
 *       popover που τον άνοιξε.
 *  Σ2 — η πλήρης οθόνη είναι ΕΠΙΦΑΝΕΙΑ με δικό της ρόλο ΚΑΤΩ από την οικογένεια: κάθε διάλογος τη νικά
 *       ανεξάρτητα από τη σειρά ανοίγματος.
 *  Σ3 — Select και Tooltip μένουν ΠΑΝΩ από την οικογένεια (Select μέσα σε Dialog: 49 αρχεία).
 *  Σ4 — η σειρά της κλίμακας που υπόσχεται όλα τα παραπάνω, και η πλωτή παλέτα του DXF (αποδίδεται ΕΞΩ
 *       από την πλήρη οθόνη για να αιωρείται πάνω της) κάθεται ανάμεσα.
 *  Σ5 — ένθετος διάλογος: ίδιο σκαλί, και ο νεότερος είναι ΜΕΤΑ στο DOM ⇒ πάνω.
 *
 * ⚠️ ΤΙ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΔΕΙ ΑΥΤΟ ΤΟ TEST: το jsdom δεν φορτώνει CSS, άρα ένας κανόνας του `globals.css`
 * που νικά την κλάση στο cascade (ήταν ακριβώς αυτό: `[data-radix-select-content]{z-index:1000}` έριχνε
 * κάθε Select από 1220 σε 1000) είναι αόρατος εδώ. Το φυλάει η CHECK 3.50 (`shadow-authority`, ZERO-TOL).
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

import { zIndexScale } from '@/styles/design-tokens/generated/tokens';
import { FullscreenOverlay } from '@/core/containers/FullscreenOverlay';
import { Dialog, DialogContent, DialogTitle } from '../dialog';
import { Popover, PopoverContent } from '../popover';
import { Sheet, SheetContent, SheetTitle } from '../sheet';
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from '../alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '../dropdown-menu';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '../context-menu';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../tooltip';

/**
 * Η κλίμακα διαβάζεται ως απλός χάρτης ώστε ένας ρόλος που ΛΕΙΠΕΙ να δίνει καθαρή αποτυχία ισχυρισμού
 * (`undefined`), όχι σφάλμα μεταγλώττισης — το «κόκκινο πρώτα» πρέπει να λέει ΤΙ λείπει.
 */
const SCALE: Readonly<Record<string, number>> = zIndexScale;

/** `transientStack` → `--z-index-transient-stack` — η ΙΔΙΑ γραμματική με τον generator. */
const cssVarOf = (role: string): string => `--z-index-${role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
const ROLE_BY_CSS_VAR = new Map(Object.keys(SCALE).map((role) => [cssVarOf(role), role]));

/** Η στρώση που ΔΗΛΩΝΕΙ η κλάση ενός στοιχείου: ρόλος της κλίμακας, ωμή τιμή ή τίποτα. */
function layerOf(el: Element | null): string {
  if (!el) throw new Error('το στοιχείο δεν αποδόθηκε — το test δεν μετράει τίποτα');
  const cls = el.getAttribute('class') ?? '';
  const token = cls.match(/(?:^|\s)z-\[var\((--z-index-[a-z0-9-]+)\)\]/);
  if (token) return ROLE_BY_CSS_VAR.get(token[1]) ?? `άγνωστο:${token[1]}`;
  const raw = cls.match(/(?:^|\s)(-?z-(?:\d+|\[[^\]]+\]))/);
  return raw ? `ωμό:${raw[1]}` : 'καμία';
}

/** Το backdrop ενός Radix modal είναι ο αμέσως προηγούμενος αδελφός της κάρτας, μέσα στο ίδιο portal. */
function backdropOf(card: HTMLElement): Element {
  const overlay = card.previousElementSibling;
  if (!overlay || !(overlay.getAttribute('class') ?? '').includes('inset-0')) {
    throw new Error('δεν βρέθηκε backdrop δίπλα στην κάρτα — άλλαξε η δομή του portal;');
  }
  return overlay;
}

const FAMILY_ROLE = 'transientStack';

describe('Σ1 — η παροδική οικογένεια μοιράζεται ΕΝΑ σκαλί', () => {
  test('Dialog: backdrop ΚΑΙ κάρτα', () => {
    render(<Dialog open><DialogContent><DialogTitle>δ</DialogTitle></DialogContent></Dialog>);
    const card = screen.getByRole('dialog');
    expect(layerOf(card)).toBe(FAMILY_ROLE);
    expect(layerOf(backdropOf(card))).toBe(FAMILY_ROLE);
  });

  test('AlertDialog: backdrop ΚΑΙ κάρτα', () => {
    render(<AlertDialog open><AlertDialogContent><AlertDialogTitle>δ</AlertDialogTitle></AlertDialogContent></AlertDialog>);
    const card = screen.getByRole('alertdialog');
    expect(layerOf(card)).toBe(FAMILY_ROLE);
    expect(layerOf(backdropOf(card))).toBe(FAMILY_ROLE);
  });

  test('Sheet: backdrop ΚΑΙ πάνελ', () => {
    render(<Sheet open><SheetContent><SheetTitle>δ</SheetTitle></SheetContent></Sheet>);
    const panel = screen.getByRole('dialog');
    expect(layerOf(panel)).toBe(FAMILY_ROLE);
    expect(layerOf(backdropOf(panel))).toBe(FAMILY_ROLE);
  });

  test('Popover', () => {
    render(<Popover open><PopoverContent>δ</PopoverContent></Popover>);
    expect(layerOf(screen.getByRole('dialog'))).toBe(FAMILY_ROLE);
  });

  test('DropdownMenu', () => {
    render(<DropdownMenu open><DropdownMenuContent><DropdownMenuItem>δ</DropdownMenuItem></DropdownMenuContent></DropdownMenu>);
    expect(layerOf(screen.getByRole('menu'))).toBe(FAMILY_ROLE);
  });

  test('ContextMenu (ανοίγει με δεξί κλικ — δεν έχει `open`)', () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger>τ</ContextMenuTrigger>
        <ContextMenuContent><ContextMenuItem>δ</ContextMenuItem></ContextMenuContent>
      </ContextMenu>,
    );
    act(() => { fireEvent.contextMenu(screen.getByText('τ')); });
    expect(layerOf(screen.getByRole('menu'))).toBe(FAMILY_ROLE);
  });
});

describe('Σ2 — η πλήρης οθόνη είναι επιφάνεια, με δικό της σκαλί', () => {
  test('το FullscreenOverlay δηλώνει `fullscreenSurface`, όχι ωμό αριθμό', () => {
    render(<FullscreenOverlay isFullscreen onToggle={() => undefined} ariaLabel="πλήρης"><p>π</p></FullscreenOverlay>);
    expect(layerOf(screen.getByRole('dialog', { name: 'πλήρης' }))).toBe('fullscreenSurface');
  });
});

describe('Σ3 — ό,τι ΠΡΕΠΕΙ να μένει πάνω από την οικογένεια', () => {
  test('Select: `elevatedDropdown`, πάνω από το σκαλί της οικογένειας', () => {
    render(<Select open><SelectTrigger>τ</SelectTrigger><SelectContent><SelectItem value="a">α</SelectItem></SelectContent></Select>);
    const role = layerOf(screen.getByRole('listbox'));
    expect(role).toBe('elevatedDropdown');
    expect(SCALE[role]).toBeGreaterThan(SCALE[FAMILY_ROLE]);
  });

  test('Tooltip: ρόλος πάνω από το σκαλί της οικογένειας', () => {
    render(<TooltipProvider><Tooltip open><TooltipTrigger>τ</TooltipTrigger><TooltipContent>δ</TooltipContent></Tooltip></TooltipProvider>);
    const content = document.querySelector('[data-radix-popper-content-wrapper] > [data-side]');
    const role = layerOf(content);
    expect(SCALE[role]).toBeGreaterThan(SCALE[FAMILY_ROLE]);
  });
});

describe('Σ4 — η σειρά της κλίμακας που τα υπόσχεται', () => {
  test('πλήρης οθόνη < πλωτή παλέτα DXF < οικογένεια < toast < Select', () => {
    const ascending = ['sticky', 'fullscreenSurface', 'workspaceSidePanel', 'modalContent', FAMILY_ROLE, 'toast', 'elevatedDropdown'];
    for (let i = 1; i < ascending.length; i += 1) {
      expect({ pair: `${ascending[i - 1]} < ${ascending[i]}`, ok: SCALE[ascending[i]] > SCALE[ascending[i - 1]] })
        .toEqual({ pair: `${ascending[i - 1]} < ${ascending[i]}`, ok: true });
    }
  });
});

describe('Σ5 — μέσα στην οικογένεια νικά ο νεότερος', () => {
  test('AlertDialog ανοιγμένο πάνω σε Dialog: ίδιο σκαλί, και ΜΕΤΑ στο DOM', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>γονέας</DialogTitle>
          <AlertDialog open><AlertDialogContent><AlertDialogTitle>παιδί</AlertDialogTitle></AlertDialogContent></AlertDialog>
        </DialogContent>
      </Dialog>,
    );
    // `hidden: true`: με το παιδί ανοιχτό, το Radix κρύβει τον γονέα από το δέντρο προσβασιμότητας
    // (aria-hidden) — που είναι ήδη ένδειξη ότι ο νεότερος κάθεται πάνω. Χωρίς αυτό η αναζήτηση
    // αποτυγχάνει για λόγο άσχετο με τη στρώση (η πρώτη γραφή του test το έκανε).
    const parent = screen.getByRole('dialog', { hidden: true });
    const child = screen.getByRole('alertdialog');
    expect(layerOf(child)).toBe(layerOf(parent));
    expect(layerOf(parent)).toBe(FAMILY_ROLE);
    // Ίδιο σκαλί ⇒ αποφασίζει η σειρά στο DOM· ο νεότερος πρέπει να ακολουθεί.
    expect(parent.compareDocumentPosition(child) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
