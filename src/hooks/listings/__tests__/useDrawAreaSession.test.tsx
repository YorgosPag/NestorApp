/**
 * ΑΓΚΥΡΕΣ — **Η ΣΥΝΕΔΡΙΑ ΣΧΕΔΙΑΣΗΣ** (ADR-885): δύο τρόποι εισόδου, μία κατάσταση.
 */

import { act, renderHook } from '@testing-library/react';

import { useDrawAreaSession } from '@/hooks/listings/useDrawAreaSession';
import { drawnAreaFromShapes } from '@/lib/listings/listing-drawn-area';
import type { GeoPoint } from '@/types/geo/coordinates';

const CENTER = { lat: 37.98, lng: 23.73 };

function circleStroke(radius: number, samples = 120): GeoPoint[] {
  return Array.from({ length: samples }, (_, k) => {
    const angle = (2 * Math.PI * k) / samples;
    return { lat: CENTER.lat + radius * Math.sin(angle), lng: CENTER.lng + radius * Math.cos(angle) };
  });
}

describe('useDrawAreaSession', () => {
  it('σύρσιμο ⇒ σχήμα· Εφαρμογή ⇒ περιοχή, και η συνεδρία κλείνει', () => {
    const { result } = renderHook(() => useDrawAreaSession());
    act(() => result.current.start(null));
    act(() => result.current.addStroke(circleStroke(0.01), 10));
    expect(result.current.shapes).toHaveLength(1);
    expect(result.current.preview).not.toBeNull();

    let applied = null as ReturnType<typeof result.current.finish>;
    act(() => {
      applied = result.current.finish();
    });
    expect(applied?.shapes).toHaveLength(1);
    expect(result.current.active).toBe(false);
  });

  it('πάτημα κορυφή-κορυφή ⇒ κλείσιμο μέσω της ίδιας πόρτας', () => {
    const { result } = renderHook(() => useDrawAreaSession());
    act(() => result.current.start(null));
    act(() => result.current.addVertex({ lat: 37.97, lng: 23.72 }));
    act(() => result.current.addVertex({ lat: 37.97, lng: 23.74 }));
    expect(result.current.canCloseTrace).toBe(false);
    act(() => result.current.addVertex({ lat: 37.99, lng: 23.73 }));
    expect(result.current.canCloseTrace).toBe(true);
    act(() => result.current.closeTrace());
    expect(result.current.shapes).toHaveLength(1);
    expect(result.current.trace).toHaveLength(0);
  });

  it('γραμμή χωρίς εμβαδόν ⇒ ειδοποίηση «rejected», κανένα σχήμα', () => {
    const { result } = renderHook(() => useDrawAreaSession());
    act(() => result.current.start(null));
    const line = Array.from({ length: 30 }, (_, k) => ({ lat: CENTER.lat + k * 0.0001, lng: CENTER.lng }));
    act(() => result.current.addStroke(line, 10));
    expect(result.current.shapes).toHaveLength(0);
    expect(result.current.notice).toBe('rejected');
  });

  it('αναίρεση: πρώτα η τελευταία κορυφή, μετά το τελευταίο σχήμα', () => {
    const { result } = renderHook(() => useDrawAreaSession());
    act(() => result.current.start(null));
    act(() => result.current.addStroke(circleStroke(0.01), 10));
    act(() => result.current.addVertex({ lat: 38.1, lng: 23.9 }));
    act(() => result.current.undo());
    expect(result.current.trace).toHaveLength(0);
    expect(result.current.shapes).toHaveLength(1);
    act(() => result.current.undo());
    expect(result.current.shapes).toHaveLength(0);
  });

  it('🏆 «Επεξεργασία» ξεκινά ΜΕ τα εφαρμοσμένα σχήματα', () => {
    const applied = drawnAreaFromShapes([
      [
        { lat: 37.97, lng: 23.72 },
        { lat: 37.97, lng: 23.74 },
        { lat: 37.99, lng: 23.73 },
      ],
    ]);
    const { result } = renderHook(() => useDrawAreaSession());
    act(() => result.current.start(applied));
    expect(result.current.shapes).toEqual(applied?.shapes);
    act(() => result.current.removeShape(0));
    expect(result.current.preview).toBeNull();
  });
});
