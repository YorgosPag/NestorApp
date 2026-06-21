/**
 * Unit tests — coordinate-parser (ADR-357 Phase 6).
 *
 * Covers all 4 patterns + unit suffixes + edge cases + looksLikeCoordSyntax + applyCoordMode.
 */

import { parseCoordInput, looksLikeCoordSyntax, applyCoordMode } from '../coordinate-parser';
import type { Point2D } from '../../../rendering/types/Types';

const REF: Point2D = { x: 1000, y: 2000 }; // lastRef in mm (10cm, 20cm at cm displayUnit)
const DISPLAY_UNIT = 'cm' as const;

// Helper: fromDisplay(n, 'cm') = n / 0.1 = n * 10 (mm)
// Actually: fromDisplay converts display→mm. cm→mm = value / 0.1 = value * 10
// So fromDisplay(100, 'cm') = 100 * 10 = 1000mm
// Let me recalculate: fromDisplay uses mmToSceneUnits(unit).
// mmToSceneUnits('cm') = 0.1 (mm per cm).
// fromDisplay(value, 'cm') = value / 0.1 = value * 10.
// So 100cm = 1000mm, 50cm = 500mm.

describe('parseCoordInput', () => {
  describe('Pattern 4: absolute cartesian (x,y)', () => {
    it('parses "100,50" as absolute in display unit', () => {
      const result = parseCoordInput('100,50', null, DISPLAY_UNIT);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(1000); // 100cm = 1000mm
      expect(result!.y).toBeCloseTo(500);  // 50cm = 500mm
    });

    it('parses with spaces around comma', () => {
      const result = parseCoordInput('100 , 50', null, DISPLAY_UNIT);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(1000);
      expect(result!.y).toBeCloseTo(500);
    });

    it('parses negative values "-100,-50"', () => {
      const result = parseCoordInput('-100,-50', null, DISPLAY_UNIT);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(-1000);
      expect(result!.y).toBeCloseTo(-500);
    });

    it('parses unit suffix "5m,3m"', () => {
      const result = parseCoordInput('5m,3m', null, DISPLAY_UNIT);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(5000); // 5m = 5000mm
      expect(result!.y).toBeCloseTo(3000); // 3m = 3000mm
    });

    it('parses mixed units "1000mm,50cm"', () => {
      const result = parseCoordInput('1000mm,50cm', null, DISPLAY_UNIT);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(1000); // 1000mm
      expect(result!.y).toBeCloseTo(500);  // 50cm = 500mm
    });

    it('ignores lastRef (absolute = no dependency on ref)', () => {
      const result = parseCoordInput('100,50', REF, DISPLAY_UNIT);
      expect(result!.x).toBeCloseTo(1000); // NOT REF.x + 1000
    });
  });

  describe('Pattern 3: relative cartesian (@x,y)', () => {
    it('parses "@100,50" relative to lastRef', () => {
      const result = parseCoordInput('@100,50', REF, DISPLAY_UNIT);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(REF.x + 1000); // 1000 + 1000 = 2000
      expect(result!.y).toBeCloseTo(REF.y + 500);  // 2000 + 500 = 2500
    });

    it('returns null when lastRef is null (relative needs anchor)', () => {
      expect(parseCoordInput('@100,50', null, DISPLAY_UNIT)).toBeNull();
    });

    it('parses "@-50,+30" with signed components', () => {
      const result = parseCoordInput('@-50,+30', REF, DISPLAY_UNIT);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(REF.x - 500);
      expect(result!.y).toBeCloseTo(REF.y + 300);
    });

    it('parses "@2m,1.5m" with unit suffixes', () => {
      const result = parseCoordInput('@2m,1.5m', REF, DISPLAY_UNIT);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(REF.x + 2000);
      expect(result!.y).toBeCloseTo(REF.y + 1500);
    });
  });

  describe('Pattern 2: absolute polar (dist<angle)', () => {
    it('parses "100<0" → point along positive X axis', () => {
      const result = parseCoordInput('100<0', null, DISPLAY_UNIT);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(1000); // 100cm * cos(0°)
      expect(result!.y).toBeCloseTo(0);
    });

    it('parses "100<90" → point along positive Y axis', () => {
      const result = parseCoordInput('100<90', null, DISPLAY_UNIT);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(0, 5);
      expect(result!.y).toBeCloseTo(1000);
    });

    it('parses "141.42<45" → approx (1000, 1000) in mm', () => {
      const result = parseCoordInput('141.42<45', null, DISPLAY_UNIT);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(1000, 0);
      expect(result!.y).toBeCloseTo(1000, 0);
    });

    it('ignores lastRef (absolute polar)', () => {
      const result = parseCoordInput('100<0', REF, DISPLAY_UNIT);
      expect(result!.x).toBeCloseTo(1000); // NOT REF.x + 1000
    });
  });

  describe('Pattern 1: relative polar (@dist<angle)', () => {
    it('parses "@100<0" → REF + (1000mm, 0)', () => {
      const result = parseCoordInput('@100<0', REF, DISPLAY_UNIT);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(REF.x + 1000);
      expect(result!.y).toBeCloseTo(REF.y);
    });

    it('parses "@100<90" → REF + (0, 1000mm)', () => {
      const result = parseCoordInput('@100<90', REF, DISPLAY_UNIT);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(REF.x, 5);
      expect(result!.y).toBeCloseTo(REF.y + 1000);
    });

    it('returns null when lastRef is null', () => {
      expect(parseCoordInput('@100<45', null, DISPLAY_UNIT)).toBeNull();
    });

    it('parses "@2m<180" → REF + (-2000, 0)', () => {
      const result = parseCoordInput('@2m<180', REF, DISPLAY_UNIT);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(REF.x - 2000, 3);
      expect(result!.y).toBeCloseTo(REF.y, 3);
    });
  });

  describe('ADR-510 Φ1 (E2): math expressions in components', () => {
    it('evaluates addition in an absolute cartesian X', () => {
      const result = parseCoordInput('100+50,0', null, DISPLAY_UNIT);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(1500); // (100+50)cm = 150cm = 1500mm
      expect(result!.y).toBeCloseTo(0);
    });

    it('evaluates multiplication with precedence', () => {
      const result = parseCoordInput('2+3*4,0', null, DISPLAY_UNIT);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(140); // (2+3*4)=14 cm = 140mm
    });

    it('evaluates parentheses', () => {
      const result = parseCoordInput('(2+3)*4,0', null, DISPLAY_UNIT);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(200); // 20cm = 200mm
    });

    it('evaluates math with a unit suffix', () => {
      const result = parseCoordInput('1.5+0.5m,0', null, DISPLAY_UNIT);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(2000); // (1.5+0.5)m = 2m = 2000mm
    });

    it('evaluates math in a relative polar distance', () => {
      const result = parseCoordInput('@50+50<0', REF, DISPLAY_UNIT);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(REF.x + 1000); // 100cm = 1000mm along +X
      expect(result!.y).toBeCloseTo(REF.y);
    });

    it('returns null when a component is a malformed expression', () => {
      expect(parseCoordInput('100+,50', null, DISPLAY_UNIT)).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns null for empty string', () => {
      expect(parseCoordInput('', null, DISPLAY_UNIT)).toBeNull();
    });

    it('returns null for plain number "500"', () => {
      expect(parseCoordInput('500', null, DISPLAY_UNIT)).toBeNull();
    });

    it('returns null for just "@"', () => {
      expect(parseCoordInput('@', REF, DISPLAY_UNIT)).toBeNull();
    });

    it('returns null for invalid coord "@abc,def"', () => {
      expect(parseCoordInput('@abc,def', REF, DISPLAY_UNIT)).toBeNull();
    });

    it('uses displayUnit default (cm) when no suffix', () => {
      const result = parseCoordInput('100,0', null, 'mm');
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(100); // 100mm when displayUnit='mm'
    });
  });
});

describe('looksLikeCoordSyntax', () => {
  it('detects @ prefix', () => expect(looksLikeCoordSyntax('@100,50')).toBe(true));
  it('detects comma', () => expect(looksLikeCoordSyntax('100,50')).toBe(true));
  it('detects angle bracket', () => expect(looksLikeCoordSyntax('100<45')).toBe(true));
  it('rejects plain number', () => expect(looksLikeCoordSyntax('500')).toBe(false));
  it('rejects negative number', () => expect(looksLikeCoordSyntax('-200.5')).toBe(false));
  it('rejects empty', () => expect(looksLikeCoordSyntax('')).toBe(false));
});

describe('applyCoordMode', () => {
  it('abs: returns text unchanged', () => {
    expect(applyCoordMode('100,50', 'abs')).toBe('100,50');
  });

  it('rel: adds @ prefix', () => {
    expect(applyCoordMode('100,50', 'rel')).toBe('@100,50');
  });

  it('rel: does not double-prefix if @ already present', () => {
    expect(applyCoordMode('@100,50', 'rel')).toBe('@100,50');
  });

  it('polar: adds @ and converts comma to <', () => {
    expect(applyCoordMode('100,45', 'polar')).toBe('@100<45');
  });

  it('polar: does not double-prefix', () => {
    expect(applyCoordMode('@100,45', 'polar')).toBe('@100<45');
  });

  it('polar: converts only first comma', () => {
    // "100,45,extra" → should only replace first comma
    expect(applyCoordMode('100,45', 'polar')).toBe('@100<45');
  });
});
