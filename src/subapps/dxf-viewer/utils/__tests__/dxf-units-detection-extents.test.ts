/**
 * ADR-362 Round 20 — import unit detection driven by the DXF's stored extents.
 *
 * Root cause reproduced here (real file: ACAD-τοπογραφικόFinal.dxf): a geo-referenced
 * metre survey declares `$INSUNITS=4` (mm) but parks stray legacy blocks (ASHADE) at the
 * origin. A RAW entity-bounds pass then spans 0 → ~131 992 (X) / 0 → ~741 923 (Y), whose
 * diagonal (~753 561) lands in the `mm` magnitude bucket → the lying mm declaration is
 * trusted → geometry is left un-scaled → the whole survey shrinks ×1000 (a 300 m plot
 * renders as 30 cm).
 *
 * The fix feeds the heuristic the junk-free `$EXTMIN/$EXTMAX` (307.8 × 168.2, diagonal
 * ~350 → `m`) instead. This locks: (1) the pure helpers, (2) the parser extents + the
 * ±1e20 sentinel guard, (3) end-to-end builder scaling with origin junk present, and
 * (4) the ADR-462 "honest mm stays mm" guard (no regression).
 */

import {
  isUsableDetectionExtent,
  resolveUnitDetectionBounds,
  computeUnitSuggestion,
} from '../scene-units';
import { DxfSceneBuilder } from '../dxf-scene-builder';
import { DxfEntityParser } from '../dxf-entity-parser';

// Clean metre-scale extents from the real survey (diagonal ≈ 350 → 'm').
const SURVEY_EXTMIN = { x: 131685.13, y: 741755.33 };
const SURVEY_EXTMAX = { x: 131992.93, y: 741923.53 };
const SURVEY_EXTENTS = { min: SURVEY_EXTMIN, max: SURVEY_EXTMAX };

// Junk-polluted computed bounds: origin ASHADE block drags min → (0,0) → diagonal ≈ 753 561 → 'mm'.
const JUNK_BOUNDS = { min: { x: 0, y: 0 }, max: { x: 131992.93, y: 741923.53 } };

describe('isUsableDetectionExtent', () => {
  it('accepts a finite, non-inverted, non-degenerate box', () => {
    expect(isUsableDetectionExtent(SURVEY_EXTENTS)).toBe(true);
  });

  it('rejects null / the AutoCAD ±1e20 uninitialized sentinel', () => {
    expect(isUsableDetectionExtent(null)).toBe(false);
    expect(isUsableDetectionExtent({ min: { x: 1e20, y: 1e20 }, max: { x: -1e20, y: -1e20 } })).toBe(false);
  });

  it('rejects an inverted box and a zero-area point', () => {
    expect(isUsableDetectionExtent({ min: { x: 10, y: 10 }, max: { x: 5, y: 5 } })).toBe(false);
    expect(isUsableDetectionExtent({ min: { x: 3, y: 3 }, max: { x: 3, y: 3 } })).toBe(false);
  });
});

describe('resolveUnitDetectionBounds', () => {
  it('prefers usable declared extents over the junk-polluted computed bounds', () => {
    expect(resolveUnitDetectionBounds(SURVEY_EXTENTS, JUNK_BOUNDS)).toBe(SURVEY_EXTENTS);
  });

  it('falls back to computed bounds when the extents are the ±1e20 sentinel / absent', () => {
    const sentinel = { min: { x: 1e20, y: 1e20 }, max: { x: -1e20, y: -1e20 } };
    expect(resolveUnitDetectionBounds(sentinel, JUNK_BOUNDS)).toBe(JUNK_BOUNDS);
    expect(resolveUnitDetectionBounds(null, JUNK_BOUNDS)).toBe(JUNK_BOUNDS);
    expect(resolveUnitDetectionBounds(null, null)).toBeNull();
  });
});

describe('computeUnitSuggestion — wizard mismatch check (ADR-462-safe mirror)', () => {
  it('flags the lying-mm survey and suggests metres from clean extents', () => {
    const s = computeUnitSuggestion(4 /* mm */, SURVEY_EXTENTS);
    expect(s.declared).toBe('mm');
    expect(s.suggested).toBe('m');
    expect(s.mismatch).toBe(true);
  });

  it('does NOT flag an honest mm drawing (declared matches magnitude)', () => {
    // Real mm building ~40 m × 30 m → 40000 × 30000 mm extents → mm bucket → no mismatch.
    const mmExtents = { min: { x: 0, y: 0 }, max: { x: 40000, y: 30000 } };
    const s = computeUnitSuggestion(4, mmExtents);
    expect(s.declared).toBe('mm');
    expect(s.suggested).toBe('mm');
    expect(s.mismatch).toBe(false);
  });

  it('never warns when no usable extent is available (suggested === declared)', () => {
    const s = computeUnitSuggestion(4, null);
    expect(s.mismatch).toBe(false);
    expect(s.suggested).toBe('mm');
  });
});

describe('DxfEntityParser.parseHeader — $EXTMIN/$EXTMAX', () => {
  const wrap = (vars: string[]): string =>
    ['0', 'SECTION', '2', 'HEADER', ...vars, '0', 'ENDSEC', '0', 'EOF'].join('\n');

  it('parses valid metre-scale extents into header.extmin / header.extmax', () => {
    const h = DxfEntityParser.parseHeader(
      wrap([
        '9', '$INSUNITS', '70', '4',
        '9', '$EXTMIN', '10', '131685.13', '20', '741755.33',
        '9', '$EXTMAX', '10', '131992.93', '20', '741923.53',
      ]).split('\n'),
    );
    expect(h.extmin).toEqual({ x: 131685.13, y: 741755.33 });
    expect(h.extmax).toEqual({ x: 131992.93, y: 741923.53 });
  });

  it('drops the ±1e20 uninitialized sentinel (leaves extents undefined)', () => {
    const h = DxfEntityParser.parseHeader(
      wrap([
        '9', '$EXTMIN', '10', '1.0E+20', '20', '1.0E+20',
        '9', '$EXTMAX', '10', '-1.0E+20', '20', '-1.0E+20',
      ]).split('\n'),
    );
    expect(h.extmin).toBeUndefined();
    expect(h.extmax).toBeUndefined();
  });
});

/**
 * Build a DXF that mirrors the real failure: lying `$INSUNITS=4`, a stray origin LINE
 * (the ASHADE-class junk), and the real geometry at metre coords. Extents are optional
 * so we can prove they are what flips detection.
 */
function makeGeoDxf(withExtents: boolean): string {
  const extents = withExtents
    ? [
        '9', '$EXTMIN', '10', '131685.13', '20', '741755.33',
        '9', '$EXTMAX', '10', '131992.93', '20', '741923.53',
      ]
    : [];
  return [
    '0', 'SECTION', '2', 'HEADER',
    '9', '$INSUNITS', '70', '4', // 4 = mm (the lie)
    ...extents,
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
    // Junk: a tiny line parked at the origin → pollutes the raw computed bounds.
    '0', 'LINE', '8', 'ASHADE', '10', '0', '20', '0', '11', '1', '21', '0',
    // Real geometry at geo-referenced metre coordinates.
    '0', 'LINE', '8', '0', '10', '131685.13', '20', '741755.33', '11', '131992.93', '21', '741923.53',
    '0', 'ENDSEC', '0', 'EOF',
  ].join('\n');
}

/** Largest X coordinate across all line entities (post-build). */
function maxLineX(scene: { entities: Array<{ type: string }> }): number {
  const xs = scene.entities
    .filter((e): e is { type: string; start: { x: number }; end: { x: number } } => e.type === 'line')
    .flatMap(l => [l.start.x, l.end.x]);
  return Math.max(...xs);
}

describe('DxfSceneBuilder.buildScene — extents drive canonical-mm scaling', () => {
  it('WITH clean extents: detects metres despite origin junk → scales ×1000', () => {
    const scene = DxfSceneBuilder.buildScene(makeGeoDxf(true));
    expect(scene.units).toBe('mm');
    // 131 992.93 m → ~131 992 930 mm. Un-scaled it would stay ~131 992.
    expect(maxLineX(scene)).toBeGreaterThan(1_000_000);
    expect(maxLineX(scene)).toBeCloseTo(131_992_930, -3);
  });

  it('WITHOUT extents: junk inflates computed bounds → mis-detected as mm → NOT scaled', () => {
    // Documents the pre-fix bug: this is exactly why the survey shrank ×1000.
    const scene = DxfSceneBuilder.buildScene(makeGeoDxf(false));
    expect(scene.units).toBe('mm');
    expect(maxLineX(scene)).toBeLessThan(200_000); // ~131 992, un-scaled
  });
});
