/**
 * @fileoverview Άγκυρες ADR-896 §7Α.5 — `ScrollRail`: βελάκια ανάλογα με τις άκρες, πάτημα ⇒ κύλιση
 * σε ΤΣΙΠ, η επιλογή σε θέα χωρίς να κουνηθεί η σελίδα.
 *
 * ⚠️ Το jsdom δεν έχει διάταξη: εδώ η λωρίδα **παίρνει** αριθμούς (5 στοιχεία × 100px, κενό 10px,
 * κάδρο 250px). Η **ορατότητα** των βελών είναι CSS (`@media (hover:hover)` + `data-scroll-edges`)
 * και επαληθεύεται ζωντανά· εδώ κλειδώνεται η κατάσταση που τη διαβάζει.
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ScrollRail } from '../scroll-rail';

const CLIENT = 250;
const ITEMS = 5;

function rect(left: number, width: number): DOMRect {
  return { left, right: left + width, top: 0, bottom: 36, width, height: 36, x: left, y: 0, toJSON: () => ({}) };
}

/** Δίνει στη λωρίδα «διάταξη»: θέσεις που ακολουθούν το `scrollLeft`, και `scrollTo` που κυλά. */
function giveLayout(scroller: HTMLElement): jest.Mock {
  let scrollLeft = 0;
  Object.defineProperty(scroller, 'scrollLeft', { configurable: true, get: () => scrollLeft });
  Object.defineProperty(scroller, 'clientWidth', { configurable: true, get: () => CLIENT });
  Object.defineProperty(scroller, 'scrollWidth', { configurable: true, get: () => ITEMS * 110 - 10 });
  scroller.getBoundingClientRect = () => rect(0, CLIENT);
  Array.from(scroller.children).forEach((child, i) => {
    (child as HTMLElement).getBoundingClientRect = () => rect(i * 110 - scrollLeft, 100);
  });
  const scrollTo = jest.fn((options: ScrollToOptions) => {
    scrollLeft = options.left ?? scrollLeft;
    scroller.dispatchEvent(new Event('scroll'));
  });
  scroller.scrollTo = scrollTo as unknown as HTMLElement['scrollTo'];
  return scrollTo;
}

function Rail({ pressed, onMount }: { readonly pressed?: number; readonly onMount?: (ul: HTMLElement) => void }) {
  return (
    <ScrollRail
      as="ul"
      prevLabel="Προηγούμενα"
      nextLabel="Επόμενα"
      revealSelector='[aria-pressed="true"]'
      revealKey={pressed}
      className="gap-2"
    >
      {Array.from({ length: ITEMS }, (_, i) => (
        <li key={i} ref={i === 0 ? (node) => node?.parentElement && onMount?.(node.parentElement) : undefined}>
          <button type="button" aria-pressed={pressed === i}>{`τσιπ ${i}`}</button>
        </li>
      ))}
    </ScrollRail>
  );
}

function scrollerOf(): HTMLElement {
  return screen.getByRole('list');
}

describe('ScrollRail — ADR-896 §7Α.5', () => {
  it('Λ1: βελάκια εκτός σειράς Tab, με όνομα από props και `aria-controls` προς τη λωρίδα', () => {
    render(<Rail />);
    const prev = screen.getByRole('button', { name: 'Προηγούμενα' });
    const next = screen.getByRole('button', { name: 'Επόμενα' });
    expect(prev).toHaveAttribute('tabindex', '-1');
    expect(next).toHaveAttribute('tabindex', '-1');
    expect(next).not.toHaveAttribute('aria-hidden');
    expect(next).toHaveAttribute('aria-controls', scrollerOf().id);
  });

  it('Λ7: η λωρίδα ΔΗΛΩΝΕΙ `flex` στις κλάσεις της — αλλιώς το shell-surface.css τη θεωρεί πρόζα (li + li = 36px)', () => {
    render(<Rail />);
    expect(scrollerOf().className).toMatch(/(^|\s)flex(\s|$)/);
    expect(scrollerOf().className).toMatch(/(^|\s)flex-nowrap(\s|$)/);
  });

  it('Λ2: χωρίς μέτρηση (καμία υπερχείλιση) ⇒ `data-scroll-edges="none"` — κανένα βελάκι δεν ανάβει', () => {
    render(<Rail />);
    expect(scrollerOf()).toHaveAttribute('data-scroll-edges', 'none');
  });

  it('Λ3: ▶ ⇒ `scrollTo` στο κομμένο τσιπ (όχι ποσοστό) και η άκρη γίνεται `both`', async () => {
    let scrollTo: jest.Mock | undefined;
    render(<Rail onMount={(ul) => { scrollTo = giveLayout(ul); }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Επόμενα' }));
    expect(scrollTo).toHaveBeenCalledWith({ left: 220, behavior: 'smooth' });
    await waitFor(() => expect(scrollerOf()).toHaveAttribute('data-scroll-edges', 'both'));
  });

  it('Λ4: το πάτημα βέλους δεν κλέβει την εστίαση (mousedown προλαμβάνεται)', () => {
    render(<Rail />);
    const next = screen.getByRole('button', { name: 'Επόμενα' });
    expect(fireEvent.mouseDown(next)).toBe(false);
  });

  it('Λ5: η επιλογή στην πρώτη απόδοση ⇒ κύλιση ΜΟΝΟ της λωρίδας, ακαριαία — ποτέ `scrollIntoView`', () => {
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    let scrollTo: jest.Mock | undefined;
    render(<Rail pressed={4} onMount={(ul) => { scrollTo = giveLayout(ul); }} />);
    expect(scrollTo).toHaveBeenCalledWith({ left: 290, behavior: 'auto' });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('Λ8: η επιλογή που ΦΑΡΔΑΙΝΕΙ μετά την αποκάλυψη (έρχονται τα πλήθη) μένει σε θέα — μέχρι να κυλήσει ο άνθρωπος', () => {
    const observers: { callback: () => void; disconnected: boolean }[] = [];
    const original = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      private readonly entry: { callback: () => void; disconnected: boolean };
      constructor(callback: () => void) {
        this.entry = { callback, disconnected: false };
        observers.push(this.entry);
      }
      observe(): void {}
      disconnect(): void { this.entry.disconnected = true; }
    };
    try {
      let scroller: HTMLElement | undefined;
      let scrollTo: jest.Mock | undefined;
      render(<Rail pressed={4} onMount={(ul) => { scroller = ul; scrollTo = giveLayout(ul); }} />);
      const follow = observers[observers.length - 1];
      scrollTo?.mockClear();
      act(() => scroller?.scrollTo({ left: 0 }));
      scrollTo?.mockClear();
      follow.callback();
      expect(scrollTo).toHaveBeenCalledWith({ left: 290, behavior: 'auto' });

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Επόμενα' }));
      expect(follow.disconnected).toBe(true);
    } finally {
      (globalThis as { ResizeObserver?: unknown }).ResizeObserver = original;
    }
  });

  it('Λ6: εστίαση με Tab σε στοιχείο εκτός κάδρου ⇒ φέρνεται σε θέα', () => {
    let scrollTo: jest.Mock | undefined;
    render(<Rail onMount={(ul) => { scrollTo = giveLayout(ul); }} />);
    // Πραγματική εστίαση (το React `onFocus` ακούει `focusin`, που το `.focus()` του jsdom εκπέμπει).
    act(() => screen.getByRole('button', { name: 'τσιπ 3' }).focus());
    expect(scrollTo).toHaveBeenCalledWith({ left: 180, behavior: 'auto' });
  });
});
