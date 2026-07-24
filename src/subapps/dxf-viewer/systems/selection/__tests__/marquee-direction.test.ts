/**
 * marquee-direction.test.ts — the shared window/crossing verdict (ADR-692, N.18 SSoT).
 * Guards the ONE rule that 2D (`UniversalMarqueeSelection`) and 3D (`collectBimMarqueeHits`) share.
 */

import { isCrossingDrag, getMarqueeSelectionType } from '../marquee-direction';

describe('marquee-direction (window/crossing SSoT)', () => {
  describe('isCrossingDrag', () => {
    it('is a crossing when the drag goes right-to-left (endX < startX)', () => {
      expect(isCrossingDrag(200, 50)).toBe(true);
    });

    it('is NOT a crossing when the drag goes left-to-right (endX > startX)', () => {
      expect(isCrossingDrag(50, 200)).toBe(false);
    });

    it('a zero-width drag is treated as window (not crossing)', () => {
      expect(isCrossingDrag(120, 120)).toBe(false);
    });
  });

  describe('getMarqueeSelectionType', () => {
    it('left-to-right ⇒ window (select fully-enclosed)', () => {
      expect(getMarqueeSelectionType(10, 400)).toBe('window');
    });

    it('right-to-left ⇒ crossing (select anything touched)', () => {
      expect(getMarqueeSelectionType(400, 10)).toBe('crossing');
    });

    it('is purely horizontal-direction based (Y is irrelevant)', () => {
      // Same X direction, opposite Y directions → same verdict.
      expect(getMarqueeSelectionType(10, 400)).toBe('window');
      expect(getMarqueeSelectionType(400, 10)).toBe('crossing');
    });
  });
});
