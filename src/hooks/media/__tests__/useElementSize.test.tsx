/**
 * ADR-884 Φ2στ-γ Γ2 — ο ΕΝΑΣ παρατηρητής μεγέθους: το ΙΔΙΟ κουτί στην πρώτη μέτρηση και σε κάθε αλλαγή, σε σκαλοπάτια.
 * ADR-899 §9 Ε4ε — `content-box` κατ' επιλογή: ό,τι μένει για τα παιδιά (η εικόνα δεν ζωγραφίζεται ποτέ στο padding).
 */

import { act, renderHook } from '@testing-library/react';

import { useElementSize, type MeasuredBox } from '../useElementSize';

type Emit = (width: number, height: number, padding: number) => void;

let emit: Emit = () => undefined;
const realObserver = global.ResizeObserver;

beforeAll(() => {
  global.ResizeObserver = class {
    constructor(private readonly cb: ResizeObserverCallback) {
      emit = (width, height, padding) => {
        const entry = {
          borderBoxSize: [{ inlineSize: width, blockSize: height }],
          contentBoxSize: [{ inlineSize: width - 2 * padding, blockSize: height - 2 * padding }],
          contentRect: { width: width - 2 * padding, height: height - 2 * padding },
        } as unknown as ResizeObserverEntry;
        this.cb([entry], this as unknown as ResizeObserver);
      };
    }
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;
});
afterAll(() => { global.ResizeObserver = realObserver; });

function mount(step: number, box: MeasuredBox = 'border-box', padding = 0) {
  const el = document.createElement('figure');
  el.getBoundingClientRect = () => new DOMRect(0, 0, 301, 199);
  if (padding > 0) el.style.padding = `${padding}px`;
  const ref = { current: el };
  let renders = 0;
  const hook = renderHook(() => { renders += 1; return useElementSize(ref, step, box); });
  return { hook, renders: () => renders };
}

describe('useElementSize', () => {
  it('πρώτη μέτρηση πριν το βάψιμο (border-box), στρογγυλεμένη στο σκαλοπάτι', () => {
    const { hook } = mount(4);
    expect(hook.result.current).toEqual({ width: 300, height: 200 });
  });

  it('κάθε αλλαγή: border-box, ΟΧΙ content-box — αλλιώς δύο μετρήσεις του ίδιου στοιχείου διαφωνούν κατά το padding', () => {
    const { hook } = mount(4);
    act(() => emit(500, 300, 8));
    expect(hook.result.current).toEqual({ width: 500, height: 300 });
  });

  it('🔴 Ε4ε content-box: και η πρώτη μέτρηση ΚΑΙ ο παρατηρητής αφαιρούν το padding — συμφωνούν μεταξύ τους', () => {
    const { hook } = mount(4, 'content-box', 16);
    expect(hook.result.current).toEqual({ width: 268, height: 168 });
    act(() => emit(500, 300, 8));
    expect(hook.result.current).toEqual({ width: 484, height: 284 });
  });

  // ⓘ Το React μπορεί να ξανατρέξει ΜΙΑ φορά το ίδιο το component πριν «δει» ότι η κατάσταση δεν άλλαξε (eager bailout
  //   μόνο με άδεια ουρά) — η εγγύηση που μετρά είναι ότι η τιμή μένει η ΙΔΙΑ αναφορά, άρα κανείς από κάτω δεν αλλάζει.
  it('ίδιο σκαλοπάτι ⇒ ΙΔΙΑ αναφορά (το σύρσιμο της στήλης δεν ξαναζωγραφίζει την κάτοψη ανά pixel)', () => {
    const { hook, renders } = mount(4);
    const before = hook.result.current;
    const rendersBefore = renders();
    act(() => emit(301, 199, 0));
    act(() => emit(299, 201, 0));
    expect(hook.result.current).toBe(before);
    expect(renders() - rendersBefore).toBeLessThanOrEqual(1);
  });
});
