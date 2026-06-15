/**
 * Tests for the pure coordinate readout/clipboard formatters (ADR-040 cursor-lag Φ7).
 */

import {
  formatScreen,
  formatCanvas,
  formatWorld,
  formatScale,
  formatOffset,
  formatBoundsSize,
  formatBoundsPosition,
  buildClipboardText,
} from '../coordinate-readout-format';
import type { ViewTransform } from '../../../rendering/types/Types';

const T: ViewTransform = { scale: 1.234, offsetX: 10.5, offsetY: -20.5 } as ViewTransform;
const RECT = { left: 100, top: 50, width: 800, height: 600 } as DOMRect;

describe('coordinate-readout-format', () => {
  it('formats screen coords rounded', () => {
    expect(formatScreen({ x: 12.7, y: 99.2 })).toBe('X: 13, Y: 99');
  });

  it('formats canvas coords relative to rect', () => {
    expect(formatCanvas({ x: 150, y: 80 }, RECT)).toBe('X: 50, Y: 30');
  });

  it('returns a placeholder for canvas coords with no rect', () => {
    expect(formatCanvas({ x: 150, y: 80 }, null)).toBe('—');
  });

  it('formats world coords to 2 decimals', () => {
    expect(formatWorld({ x: 3.14159, y: -2.5 })).toBe('X: 3.14, Y: -2.50');
  });

  it('formats transform scale + offset', () => {
    expect(formatScale(T)).toBe('1.234');
    expect(formatOffset(T)).toBe('(10.5, -20.5)');
  });

  it('formats canvas bounds size + position', () => {
    expect(formatBoundsSize(RECT)).toBe('800 × 600');
    expect(formatBoundsPosition(RECT)).toBe('(100, 50)');
  });

  describe('buildClipboardText', () => {
    const snap = {
      screen: { x: 200, y: 130 },
      canvas: { x: 100, y: 80 },
      world: { x: 5.5, y: 6.25 },
      transform: T,
      stamp: 'abc123@1000',
    };

    it('builds screen-only text (F2)', () => {
      expect(buildClipboardText('s', snap)).toBe('Screen: (200, 130) [abc123@1000]');
    });

    it('builds world-only text (F3)', () => {
      expect(buildClipboardText('w', snap)).toBe('World: (5.50, 6.25) [abc123@1000]');
    });

    it('builds transform-only text (F4)', () => {
      expect(buildClipboardText('t', snap)).toBe(
        'Transform: Scale=1.234, Offset=(10.5, -20.5) [abc123@1000]',
      );
    });

    it('builds all-data text (F1) including canvas', () => {
      expect(buildClipboardText('c', snap)).toContain('Screen: (200, 130)');
      expect(buildClipboardText('c', snap)).toContain('Canvas: (100, 80)');
      expect(buildClipboardText('c', snap)).toContain('World: (5.50, 6.25)');
      expect(buildClipboardText('c', snap)).toContain('Transform: Scale=1.234');
    });

    it('omits canvas from all-data text when canvas is null', () => {
      expect(buildClipboardText('c', { ...snap, canvas: null })).not.toContain('Canvas:');
    });
  });
});
