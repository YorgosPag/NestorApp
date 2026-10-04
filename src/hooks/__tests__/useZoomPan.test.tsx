/**
 * ADR-187 · ADR-884 Φ2στ-γ Γ2 — `useZoomPan` μετά την εξαγωγή των μαθηματικών του στο `lib/geometry/zoom-pan-math`:
 * η συμπεριφορά που βλέπει το `FloorplanGallery` μένει ΑΚΡΙΒΩΣ η ίδια.
 */

import { act, renderHook } from '@testing-library/react';
import type { MouseEvent as ReactMouseEvent, TouchEvent } from 'react';

import { useZoomPan } from '../useZoomPan';

function touches(...points: ReadonlyArray<readonly [number, number]>): TouchEvent {
  return { touches: points.map(([clientX, clientY]) => ({ clientX, clientY })), preventDefault: () => undefined } as unknown as TouchEvent;
}

function mouse(clientX: number, clientY: number): ReactMouseEvent {
  return { button: 0, clientX, clientY, preventDefault: () => undefined } as unknown as ReactMouseEvent;
}

/** Κουτί + περιεχόμενο με μετρήσιμες διαστάσεις (το jsdom δεν έχει διάταξη). */
function frame(box: readonly [number, number], content: readonly [number, number]) {
  const container = document.createElement('figure');
  container.getBoundingClientRect = () => new DOMRect(0, 0, box[0], box[1]);
  Object.defineProperties(container, { clientWidth: { value: box[0] }, clientHeight: { value: box[1] } });
  const img = document.createElement('img');
  Object.defineProperties(img, { offsetWidth: { value: content[0] }, offsetHeight: { value: content[1] } });
  return { container, img };
}

describe('useZoomPan', () => {
  it('κουμπιά: προσθετικό βήμα από προεπιλογή, κομμένο στα όρια', () => {
    const { result } = renderHook(() => useZoomPan({ minZoom: 0.5, maxZoom: 1.5 }));
    act(() => result.current.zoomIn());
    expect(result.current.zoom).toBe(1.25);
    act(() => { result.current.zoomIn(); result.current.zoomIn(); });
    expect(result.current.zoom).toBe(1.5);
    act(() => result.current.zoomOut());
    expect(result.current.zoom).toBe(1.25);
  });

  it('κουμπιά: πολλαπλασιαστικό με `zoomFactor` (Figma/Revit)', () => {
    const { result } = renderHook(() => useZoomPan({ maxZoom: 32, zoomFactor: 1.5 }));
    act(() => result.current.zoomIn());
    expect(result.current.zoom).toBe(1.5);
    act(() => result.current.zoomOut());
    expect(result.current.zoom).toBe(1);
  });

  it('τροχός: το σημείο κάτω από τον δείκτη μένει ακίνητο (ο τύπος πριν την εξαγωγή)', () => {
    const { result } = renderHook(() => useZoomPan({ maxZoom: 8 }));
    const el = document.createElement('figure');
    el.getBoundingClientRect = () => new DOMRect(0, 0, 200, 100);
    act(() => result.current.containerRef(el));
    act(() => { el.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: 150, clientY: 70, cancelable: true })); });
    const ratio = 1.1; // 1 · (1 + 100 · 0.001)
    expect(result.current.zoom).toBeCloseTo(ratio);
    // δείκτης σχετικά με το κέντρο: (50, 20) ⇒ pan = m·(1 − r)
    expect(result.current.panOffset.x).toBeCloseTo(50 * (1 - ratio));
    expect(result.current.panOffset.y).toBeCloseTo(20 * (1 - ratio));
  });

  it('σμίκρυνση στο ≤ 1 ⇒ η μετατόπιση μηδενίζεται', () => {
    const { result } = renderHook(() => useZoomPan());
    act(() => result.current.zoomIn());
    act(() => result.current.handlers.onTouchStart(touches([0, 0])));
    act(() => result.current.handlers.onTouchMove(touches([30, 10])));
    expect(result.current.panOffset).toEqual({ x: 30, y: 10 });
    act(() => result.current.zoomOut());
    expect(result.current.panOffset).toEqual({ x: 0, y: 0 });
  });

  it('pinch: ζουμ ∝ λόγος αποστάσεων των δαχτύλων', () => {
    const { result } = renderHook(() => useZoomPan({ maxZoom: 8 }));
    act(() => result.current.handlers.onTouchStart(touches([0, 0], [30, 40])));
    act(() => result.current.handlers.onTouchMove(touches([0, 0], [60, 80])));
    expect(result.current.zoom).toBeCloseTo(2);
  });

  // ── ADR-899 §9 θέμα 3: ό,τι χρειάστηκε για να γίνει ο ΕΝΑΣ θεατής εικόνας ──────────────────────────────

  it('🔴 σύρση: συνεχίζει έξω από το κουτί (window) και σταματά στο mouseup', () => {
    const { result } = renderHook(() => useZoomPan());
    act(() => result.current.handlers.onMouseDown(mouse(10, 10)));
    expect(result.current.isPanning).toBe(true);
    act(() => { window.dispatchEvent(new MouseEvent('mousemove', { clientX: 60, clientY: 30 })); });
    expect(result.current.panOffset).toEqual({ x: 50, y: 20 });
    act(() => { window.dispatchEvent(new MouseEvent('mouseup')); });
    expect(result.current.isPanning).toBe(false);
    act(() => { window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 300 })); });
    expect(result.current.panOffset).toEqual({ x: 50, y: 20 });
  });

  it('🔴 confinePan: στο «χωρά» καμία μετατόπιση ούτε «χεράκι»· μεγεθυσμένο ⇒ ως την άκρη', () => {
    const { result } = renderHook(() => useZoomPan({ minZoom: 1, maxZoom: 8, zoomFactor: 2, confinePan: true }));
    const { container, img } = frame([400, 300], [400, 300]);
    act(() => { result.current.containerRef(container); result.current.contentRef(img); });
    act(() => result.current.handlers.onMouseDown(mouse(0, 0)));
    act(() => { window.dispatchEvent(new MouseEvent('mousemove', { clientX: 90, clientY: 90 })); });
    act(() => { window.dispatchEvent(new MouseEvent('mouseup')); });
    expect(result.current.panOffset).toEqual({ x: 0, y: 0 });
    expect(result.current.cursorClass).toBe('');
    act(() => result.current.zoomIn()); // 800×600 σε 400×300 ⇒ περιθώριο (200, 150)
    expect(result.current.cursorClass).toBe('cursor-grab');
    act(() => result.current.handlers.onMouseDown(mouse(0, 0)));
    act(() => { window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: -500 })); });
    expect(result.current.panOffset).toEqual({ x: 200, y: -150 });
  });

  it('🔴 confinePan + στροφή: στα 90° οι άξονες του περιθωρίου ανταλλάσσονται', () => {
    const { result } = renderHook(() => useZoomPan({ minZoom: 1, maxZoom: 8, zoomFactor: 2, confinePan: true }));
    const { container, img } = frame([400, 400], [400, 200]);
    act(() => { result.current.containerRef(container); result.current.contentRef(img); });
    act(() => { result.current.zoomIn(); result.current.rotateBy90(); }); // ζωγραφισμένο 400×800 ⇒ περιθώριο (0, 200)
    act(() => result.current.handlers.onMouseDown(mouse(0, 0)));
    act(() => { window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 300 })); });
    expect(result.current.panOffset).toEqual({ x: 0, y: 200 });
  });

  it('contentRef: ο μετασχηματισμός εφαρμόζεται imperative — translate · scale · rotate', () => {
    const { result } = renderHook(() => useZoomPan({ zoomFactor: 2 }));
    const { img } = frame([400, 300], [400, 300]);
    act(() => result.current.contentRef(img));
    act(() => { result.current.zoomIn(); result.current.rotateBy90(); });
    expect(img.style.transform).toBe('translate(0px, 0px) scale(2) rotate(90deg)');
    act(() => result.current.resetAll());
    expect(result.current.rotation).toBe(0);
    expect(img.style.transform).toBe('translate(0px, 0px) scale(1) rotate(0deg)');
  });

  it('🔴 pinch: μεγεθύνει γύρω από το μέσο των δαχτύλων, όχι γύρω από το κέντρο', () => {
    const { result } = renderHook(() => useZoomPan({ maxZoom: 8 }));
    const { container } = frame([200, 100], [200, 100]);
    act(() => result.current.containerRef(container));
    act(() => result.current.handlers.onTouchStart(touches([100, 50], [140, 50]))); // μέσο (120,50) ⇒ άγκυρα (20, 0)
    act(() => result.current.handlers.onTouchMove(touches([80, 50], [160, 50])));
    expect(result.current.zoom).toBeCloseTo(2);
    expect(result.current.panOffset.x).toBeCloseTo(-20);
    expect(result.current.panOffset.y).toBeCloseTo(0);
  });

  it('διπλό κλικ: εναλλαγή «χωρά» ↔ μεγέθυνση γύρω από τον δείκτη', () => {
    const { result } = renderHook(() => useZoomPan({ maxZoom: 8, doubleClickZoom: 3 }));
    const { container } = frame([200, 100], [200, 100]);
    act(() => result.current.containerRef(container));
    act(() => result.current.handlers.onDoubleClick(mouse(150, 70))); // άγκυρα (50, 20)
    expect(result.current.zoom).toBe(3);
    expect(result.current.panOffset).toEqual({ x: -100, y: -40 });
    act(() => result.current.handlers.onDoubleClick(mouse(10, 10)));
    expect(result.current.zoom).toBe(1);
    expect(result.current.panOffset).toEqual({ x: 0, y: 0 });
  });
});

describe('useZoomPan — refitOnRotate (ADR-899 §9 θέμα 5β)', () => {
  const realObserver = global.ResizeObserver;
  beforeAll(() => {
    // Χωρίς `ResizeObserver` το `useElementSize` δεν μετρά ποτέ (jsdom) ⇒ το «ξαναχωρά» θα έμενε σβηστό.
    global.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof ResizeObserver;
  });
  afterAll(() => { global.ResizeObserver = realObserver; });

  const REFIT = { minZoom: 1, maxZoom: 8, zoomFactor: 2, confinePan: true, refitOnRotate: true } as const;

  it('🔴 Σ1 οριζόντια σε φαρδύ κουτί: στα 90° μικραίνει ×0,75 — «100%» μένει 100%, pan 0, χωρίς «χεράκι»', () => {
    const { result } = renderHook(() => useZoomPan({ ...REFIT, contentDimensions: { width: 4000, height: 3000 } }));
    const { container, img } = frame([1872, 704], [939, 704]);
    act(() => { result.current.containerRef(container); result.current.contentRef(img); });
    act(() => result.current.rotateBy90());
    expect(result.current.zoom).toBe(1);
    expect(result.current.scale).toBeCloseTo(0.75, 2);
    expect(img.style.transform).toMatch(/^translate\(0px, 0px\) scale\(0\.7\d+\) rotate\(90deg\)$/);
    expect(result.current.cursorClass).toBe('');
    act(() => result.current.handlers.onMouseDown(mouse(0, 0)));
    act(() => { window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 300 })); });
    act(() => { window.dispatchEvent(new MouseEvent('mouseup')); });
    expect(result.current.panOffset).toEqual({ x: 0, y: 0 });
    act(() => result.current.rotateBy90()); // 180° ⇒ πίσω στο layout
    expect(result.current.scale).toBe(1);
  });

  it('🔴 Σ3 κάθετη σε φαρδύ κουτί: στα 90° μεγαλώνει ×1,333 και ο περιορισμός μετρά τη ΝΕΑ έκταση', () => {
    const { result } = renderHook(() => useZoomPan({ ...REFIT, contentDimensions: { width: 3000, height: 4000 } }));
    const { container, img } = frame([1872, 704], [528, 704]);
    act(() => { result.current.containerRef(container); result.current.contentRef(img); });
    act(() => result.current.rotateBy90());
    expect(result.current.scale).toBeCloseTo(4 / 3, 2); // ζωγραφισμένο 939×704: γεμίζει το ύψος
    expect(result.current.cursorClass).toBe('');
    act(() => result.current.zoomIn()); // ×2 ⇒ 1877×1408 σε 1872×704 ⇒ περιθώριο y = 352 (χωρίς fit: 176)
    act(() => result.current.handlers.onMouseDown(mouse(0, 0)));
    act(() => { window.dispatchEvent(new MouseEvent('mousemove', { clientX: 0, clientY: 900 })); });
    expect(result.current.panOffset.y).toBeCloseTo(352, 0);
  });

  it('χωρίς δηλωμένες διαστάσεις: το layout είναι το φράγμα — η στραμμένη μόνο μικραίνει', () => {
    const { result } = renderHook(() => useZoomPan(REFIT));
    const { container, img } = frame([1872, 704], [528, 704]);
    act(() => { result.current.containerRef(container); result.current.contentRef(img); });
    act(() => result.current.rotateBy90());
    expect(result.current.scale).toBe(1); // 704×528 χωρά ήδη· καμία επινοημένη μεγέθυνση
  });
});

