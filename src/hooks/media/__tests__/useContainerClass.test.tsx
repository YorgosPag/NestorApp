/**
 * @fileoverview ΑΓΚΥΡΑ — **το πλάτος του ΠΕΡΙΕΚΤΗ**, όχι του παραθύρου (ADR-777 §8.75).
 * @related hooks/media/useContainerClass.ts
 *
 *   Π1 · το κατώφλι είναι σε **rem**: ίδιο πλάτος, μεγαλύτερη γραμματοσειρά ⇒ `narrow` (WCAG 1.4.4).
 *   Π2 · ο περιέκτης αλλάζει (στήλη ανοίγει/κλείνει, zoom) ⇒ η απάντηση ακολουθεί.
 *   Π3 · χωρίς `ResizeObserver` ⇒ `measuring` για πάντα — το «δεν ξέρω» δεν γίνεται «φαρδύς».
 */

import React, { useRef } from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { useContainerClass } from '../useContainerClass';

type Listener = (entries: Array<{ contentRect: { width: number } }>) => void;

let listener: Listener | null = null;
let initialWidth = 0;

class FakeResizeObserver {
  constructor(callback: Listener) {
    listener = callback;
  }
  observe(): void {}
  disconnect(): void {
    listener = null;
  }
}

function Probe({ minRem, zeroWidth }: { readonly minRem: number; readonly zeroWidth?: 'narrow' | 'measuring' }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const value = useContainerClass(ref, minRem, { zeroWidth });
  return <div ref={ref} data-testid="probe" data-value={value} />;
}

const originalObserver = globalThis.ResizeObserver;
const originalRect = HTMLElement.prototype.getBoundingClientRect;

beforeEach(() => {
  HTMLElement.prototype.getBoundingClientRect = () => ({ width: initialWidth }) as DOMRect;
  document.documentElement.style.fontSize = '';
});

afterEach(() => {
  globalThis.ResizeObserver = originalObserver;
  HTMLElement.prototype.getBoundingClientRect = originalRect;
  document.documentElement.style.fontSize = '';
  listener = null;
});

function installFakeObserver(): void {
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
}

describe('useContainerClass', () => {
  it('Π1 · το κατώφλι ακολουθεί τη γραμματοσειρά του χρήστη', () => {
    installFakeObserver();
    initialWidth = 840;

    document.documentElement.style.fontSize = '16px';
    const { unmount } = render(<Probe minRem={52} />);
    expect(screen.getByTestId('probe')).toHaveAttribute('data-value', 'wide');
    unmount();

    // 52rem × 20px = 1040px > 840px: ο ίδιος χώρος δεν χωρά πια με μεγαλύτερα γράμματα.
    document.documentElement.style.fontSize = '20px';
    render(<Probe minRem={52} />);
    expect(screen.getByTestId('probe')).toHaveAttribute('data-value', 'narrow');
  });

  it('Π2 · ο περιέκτης στενεύει και φαρδαίνει ⇒ η απάντηση ακολουθεί', () => {
    installFakeObserver();
    initialWidth = 900;
    render(<Probe minRem={52} />);
    expect(screen.getByTestId('probe')).toHaveAttribute('data-value', 'wide');

    act(() => listener?.([{ contentRect: { width: 700 } }]));
    expect(screen.getByTestId('probe')).toHaveAttribute('data-value', 'narrow');

    act(() => listener?.([{ contentRect: { width: 832 } }]));
    expect(screen.getByTestId('probe')).toHaveAttribute('data-value', 'wide');
  });

  it('Π3 · χωρίς ResizeObserver ⇒ `measuring`, ποτέ μαντεψιά', () => {
    globalThis.ResizeObserver = undefined as unknown as typeof ResizeObserver;
    initialWidth = 2000;
    render(<Probe minRem={52} />);
    expect(screen.getByTestId('probe')).toHaveAttribute('data-value', 'measuring');
  });

  it('Π4 · πλάτος 0 = «στενό» από προεπιλογή — η συμπεριφορά πριν από το ADR-912', () => {
    installFakeObserver();
    initialWidth = 0;
    render(<Probe minRem={52} />);
    expect(screen.getByTestId('probe')).toHaveAttribute('data-value', 'narrow');
  });

  it('Π5 · με `zeroWidth: measuring`, περιέκτης χωρίς διάταξη ΔΕΝ είναι στενός — και γίνεται όταν μετρηθεί', () => {
    installFakeObserver();
    initialWidth = 0;
    render(<Probe minRem={52} zeroWidth="measuring" />);
    expect(screen.getByTestId('probe')).toHaveAttribute('data-value', 'measuring');

    act(() => listener?.([{ contentRect: { width: 390 } }]));
    expect(screen.getByTestId('probe')).toHaveAttribute('data-value', 'narrow');

    // Η καρτέλα κρύβεται ξανά (display:none) ⇒ πίσω στο «δεν ξέρω», όχι «στενό».
    act(() => listener?.([{ contentRect: { width: 0 } }]));
    expect(screen.getByTestId('probe')).toHaveAttribute('data-value', 'measuring');
  });
});
