/**
 * ADR-408 Εύρος Β #2 — `useMepBoilerTool` ghost projection tests.
 *
 * Focus: the WYSIWYG placement-ghost getters (`getGhostFootprint` / `getGhostSymbol`)
 * are pure, gated on `awaitingPosition`, and share ONE params builder so the preview
 * never drifts from the committed entity:
 *   - both return null when idle or cursorPos=null
 *   - getGhostSymbol returns the full `buildMepBoilerSymbol` geometry (divider+flame
 *     glyph = 4 strokes, supply+return pipe stubs ≥ 2) at the cursor
 *   - the symbol's outline === the footprint vertices (same geometry SSoT) → WYSIWYG
 */

import { renderHook, act } from '@testing-library/react';
import { useMepBoilerTool } from '../useMepBoilerTool';

describe('useMepBoilerTool ghost projection', () => {
  const cursor = { x: 1200, y: 3400 };

  it('getGhostFootprint / getGhostSymbol return null when idle', () => {
    const { result } = renderHook(() => useMepBoilerTool({ onMepBoilerCreated: jest.fn() }));
    expect(result.current.getGhostFootprint(cursor)).toBeNull();
    expect(result.current.getGhostSymbol(cursor)).toBeNull();
  });

  it('getGhostSymbol returns null when cursorPos=null even while awaitingPosition', () => {
    const { result } = renderHook(() => useMepBoilerTool({ onMepBoilerCreated: jest.fn() }));
    act(() => result.current.activate());
    expect(result.current.getGhostSymbol(null)).toBeNull();
  });

  it('getGhostSymbol returns the full boiler symbol while awaitingPosition', () => {
    const { result } = renderHook(() => useMepBoilerTool({ onMepBoilerCreated: jest.fn() }));
    act(() => result.current.activate());
    const symbol = result.current.getGhostSymbol(cursor);
    expect(symbol).not.toBeNull();
    // Divider (1) + flame triangle (3 legs) = 4 glyph strokes — boiler's signature glyph.
    expect(symbol!.glyphStrokes).toHaveLength(4);
    // At least the hydronic supply + return pipe stubs.
    expect(symbol!.strokes.length).toBeGreaterThanOrEqual(2);
    // Outline is a closed rectangular cabinet.
    expect(symbol!.outline).toHaveLength(4);
  });

  it('symbol outline === footprint vertices (shared geometry SSoT → WYSIWYG)', () => {
    const { result } = renderHook(() => useMepBoilerTool({ onMepBoilerCreated: jest.fn() }));
    act(() => result.current.activate());
    const footprint = result.current.getGhostFootprint(cursor);
    const symbol = result.current.getGhostSymbol(cursor);
    expect(footprint).not.toBeNull();
    expect(symbol).not.toBeNull();
    expect(symbol!.outline).toEqual(footprint);
  });
});
