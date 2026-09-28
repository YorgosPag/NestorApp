/**
 * ADR-187 · ADR-884 Φ2στ-γ Γ2 — `useZoomPan` μετά την εξαγωγή των μαθηματικών του στο `lib/geometry/zoom-pan-math`:
 * η συμπεριφορά που βλέπει το `FloorplanGallery` μένει ΑΚΡΙΒΩΣ η ίδια.
 */

import { act, renderHook } from '@testing-library/react';
import type { TouchEvent } from 'react';

import { useZoomPan } from '../useZoomPan';

function touches(...points: ReadonlyArray<readonly [number, number]>): TouchEvent {
  return { touches: points.map(([clientX, clientY]) => ({ clientX, clientY })), preventDefault: () => undefined } as unknown as TouchEvent;
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
});
