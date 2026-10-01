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
import { useDismissOnRailScroll } from '../scroll-rail-context';

/** Ένα «τσιπ» με αναδυόμενο: μόνο το hook, χωρίς Radix. */
function DismissProbe({ open, onDismiss }: { readonly open: boolean; readonly onDismiss: () => void }) {
  useDismissOnRailScroll(open, onDismiss);
  return <button type="button">probe</button>;
}

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

  it('Λ9: `frameClassName` πάει στο ΠΕΡΙΒΛΗΜΑ (θέση στη διάταξη), όχι στη λωρίδα (ADR-896 §7Α.6)', () => {
    // `min-w-0 flex-1` δίπλα σε καρφωμένα κουμπιά: χωρίς αυτό ο καταναλωτής θα πρόσθετε `<div>` μόνο για πλάτος.
    render(
      <ScrollRail prevLabel="Προηγούμενα" nextLabel="Επόμενα" frameClassName="min-w-0 flex-1">
        <button type="button">τσιπ</button>
      </ScrollRail>,
    );
    const frame = screen.getByRole('button', { name: 'Επόμενα' }).parentElement;
    expect(frame?.className).toMatch(/(^|\s)flex-1(\s|$)/);
    const scroller = frame?.querySelector('[data-scroll-edges]');
    expect(scroller?.className).not.toMatch(/(^|\s)flex-1(\s|$)/);
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

  it('Λ10: εστίαση με ΔΕΙΚΤΗ ⇒ η λωρίδα ΔΕΝ κυλά πριν το `click` — αλλιώς το κλικ χάνεται (ADR-896 §7Α.6)', () => {
    // Μετρημένο ζωντανά: κύλιση στο mousedown ⇒ το τσιπ φεύγει κάτω από τον δείκτη ⇒ το `click`
    // πηγαίνει στον κοινό πρόγονο και το αναδυόμενο δεν ανοίγει.
    let scrollTo: jest.Mock | undefined;
    const onChip = jest.fn();
    render(<Rail onMount={(ul) => { scrollTo = giveLayout(ul); }} />);
    const chip = screen.getByRole('button', { name: 'τσιπ 3' });
    chip.addEventListener('click', () => onChip(scrollTo?.mock.calls.length));
    fireEvent.pointerDown(chip);
    act(() => chip.focus());
    expect(scrollTo).not.toHaveBeenCalled();
    fireEvent.pointerUp(chip);
    fireEvent.click(chip);
    // Ο χειριστής του τσιπ έτρεξε ΠΡΙΝ από την κύλιση — και η κύλιση έγινε μετά.
    expect(onChip).toHaveBeenCalledWith(0);
    expect(scrollTo).toHaveBeenCalledWith({ left: 180, behavior: 'auto' });
  });

  it('Λ12: οριζόντιος τροχός στη λωρίδα ⇒ το ανοιχτό αναδυόμενο ενός παιδιού ΚΛΕΙΝΕΙ (όχι ορφανό)', () => {
    const onDismiss = jest.fn();
    render(
      <ScrollRail prevLabel="Προηγούμενα" nextLabel="Επόμενα">
        <DismissProbe open onDismiss={onDismiss} />
      </ScrollRail>,
    );
    const scroller = screen.getByRole('button', { name: 'probe' }).parentElement as HTMLElement;
    fireEvent.wheel(scroller, { deltaY: 40 });
    expect(onDismiss).not.toHaveBeenCalled(); // κατακόρυφος τροχός = κυλά τη σελίδα, όχι τη λωρίδα
    fireEvent.wheel(scroller, { deltaX: 40 });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('Λ13: έξω από λωρίδα (πάνελ) ή κλειστό ⇒ το hook δεν κάνει τίποτα', () => {
    const onDismiss = jest.fn();
    const { rerender } = render(<DismissProbe open onDismiss={onDismiss} />);
    fireEvent.wheel(screen.getByRole('button', { name: 'probe' }), { deltaX: 40 });
    rerender(
      <ScrollRail prevLabel="Προηγούμενα" nextLabel="Επόμενα">
        <DismissProbe open={false} onDismiss={onDismiss} />
      </ScrollRail>,
    );
    fireEvent.wheel(screen.getByRole('button', { name: 'probe' }).parentElement as HTMLElement, { deltaX: 40 });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('Λ11: δείκτης που αφέθηκε ΕΞΩ από τη λωρίδα δεν «κολλά» — το επόμενο Tab αποκαλύπτει αμέσως', () => {
    let scrollTo: jest.Mock | undefined;
    render(<Rail onMount={(ul) => { scrollTo = giveLayout(ul); }} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'τσιπ 0' }));
    fireEvent.pointerUp(window);
    act(() => screen.getByRole('button', { name: 'τσιπ 3' }).focus());
    expect(scrollTo).toHaveBeenCalledWith({ left: 180, behavior: 'auto' });
  });
});
