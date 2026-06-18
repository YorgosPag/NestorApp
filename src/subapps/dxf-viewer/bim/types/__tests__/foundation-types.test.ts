/**
 * Tests — foundation-types.ts (ADR-436, Slice 0).
 *
 * Coverage:
 *   - buildDefaultFoundationParams ανά kind (σωστό discriminator + defaults)
 *   - FOUNDATION_IFC_MAP πληρότητα + ορθότητα (total over FoundationKind)
 *   - below-grade default elevation (αρνητικό top, ADR-369)
 */

import {
  buildDefaultFoundationParams,
  defaultFoundationTopElevationMm,
  resolveFoundationTopElevationMm,
  TIE_BEAM_RISE_MM,
  FOUNDATION_IFC_MAP,
  DEFAULT_FOUNDATION_TOP_ELEVATION_MM,
  DEFAULT_TIE_BEAM_TOP_ELEVATION_MM,
  DEFAULT_PAD_WIDTH_MM,
  DEFAULT_PAD_LENGTH_MM,
  DEFAULT_STRIP_WIDTH_MM,
  DEFAULT_TIE_BEAM_WIDTH_MM,
  type FoundationKind,
} from '../foundation-types';

const ALL_KINDS: readonly FoundationKind[] = ['pad', 'strip', 'tie-beam'];

describe('buildDefaultFoundationParams', () => {
  it.each(ALL_KINDS)('kind=%s → matching discriminator', (kind) => {
    expect(buildDefaultFoundationParams(kind).kind).toBe(kind);
  });

  it('below-grade default top elevation (αρνητικό) για όλα τα kinds', () => {
    for (const kind of ALL_KINDS) {
      const p = buildDefaultFoundationParams(kind);
      expect(p.topElevationMm).toBe(defaultFoundationTopElevationMm(kind));
      expect(p.topElevationMm).toBeLessThan(0);
    }
  });

  it('συνδετήρια δοκός κάθεται ΨΗΛΟΤΕΡΑ από πεδιλοδοκό (Eurocode 8 — δεν θάβεται μέσα της)', () => {
    expect(defaultFoundationTopElevationMm('strip')).toBe(DEFAULT_FOUNDATION_TOP_ELEVATION_MM);
    expect(defaultFoundationTopElevationMm('pad')).toBe(DEFAULT_FOUNDATION_TOP_ELEVATION_MM);
    expect(defaultFoundationTopElevationMm('tie-beam')).toBe(DEFAULT_TIE_BEAM_TOP_ELEVATION_MM);
    expect(DEFAULT_TIE_BEAM_TOP_ELEVATION_MM).toBeGreaterThan(DEFAULT_FOUNDATION_TOP_ELEVATION_MM);
  });

  it('thickness θετικό για όλα τα kinds', () => {
    for (const kind of ALL_KINDS) {
      expect(buildDefaultFoundationParams(kind).thicknessMm).toBeGreaterThan(0);
    }
  });

  it('pad: point-based με position + width/length + anchor + flat profile', () => {
    const p = buildDefaultFoundationParams('pad');
    if (p.kind !== 'pad') throw new Error('narrowing');
    expect(p.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(p.width).toBe(DEFAULT_PAD_WIDTH_MM);
    expect(p.length).toBe(DEFAULT_PAD_LENGTH_MM);
    expect(p.anchor).toBe('center');
    expect(p.profile).toBe('flat');
    expect(p.stepped).toBeUndefined();
    expect(p.sloped).toBeUndefined();
  });

  it('strip: line-based με start/end + width', () => {
    const p = buildDefaultFoundationParams('strip');
    if (p.kind !== 'strip') throw new Error('narrowing');
    expect(p.start).toEqual({ x: 0, y: 0, z: 0 });
    expect(p.end.x).toBeGreaterThan(0);
    expect(p.width).toBe(DEFAULT_STRIP_WIDTH_MM);
  });

  it('tie-beam: line-based με start/end + width', () => {
    const p = buildDefaultFoundationParams('tie-beam');
    if (p.kind !== 'tie-beam') throw new Error('narrowing');
    expect(p.start).toEqual({ x: 0, y: 0, z: 0 });
    expect(p.end.x).toBeGreaterThan(0);
    expect(p.width).toBe(DEFAULT_TIE_BEAM_WIDTH_MM);
  });
});

describe('resolveFoundationTopElevationMm (ADR-484 Slice 4 — από τις ρυθμίσεις)', () => {
  it('FFL γνωστό → pad/strip = FFL· tie-beam = FFL + rise', () => {
    expect(resolveFoundationTopElevationMm(-1500, 'pad')).toBe(-1500);
    expect(resolveFoundationTopElevationMm(-1500, 'strip')).toBe(-1500);
    expect(resolveFoundationTopElevationMm(-1500, 'tie-beam')).toBe(-1500 + TIE_BEAM_RISE_MM);
  });

  it('FFL = default (-1000) → ακριβώς τα παλιά constants (μηδέν regression)', () => {
    for (const kind of ALL_KINDS) {
      expect(resolveFoundationTopElevationMm(DEFAULT_FOUNDATION_TOP_ELEVATION_MM, kind)).toBe(
        defaultFoundationTopElevationMm(kind),
      );
    }
  });

  it('FFL null/undefined → fallback στα default constants', () => {
    for (const kind of ALL_KINDS) {
      expect(resolveFoundationTopElevationMm(null, kind)).toBe(defaultFoundationTopElevationMm(kind));
      expect(resolveFoundationTopElevationMm(undefined, kind)).toBe(defaultFoundationTopElevationMm(kind));
    }
  });

  it('TIE_BEAM_RISE_MM = διαφορά των constants (συνεπές)', () => {
    expect(TIE_BEAM_RISE_MM).toBe(
      DEFAULT_TIE_BEAM_TOP_ELEVATION_MM - DEFAULT_FOUNDATION_TOP_ELEVATION_MM,
    );
    expect(TIE_BEAM_RISE_MM).toBeGreaterThan(0);
  });
});

describe('FOUNDATION_IFC_MAP', () => {
  it('total over FoundationKind (κάθε kind έχει predefinedType)', () => {
    for (const kind of ALL_KINDS) {
      expect(FOUNDATION_IFC_MAP[kind]).toBeDefined();
    }
    expect(Object.keys(FOUNDATION_IFC_MAP).sort()).toEqual([...ALL_KINDS].sort());
  });

  it('σωστή IFC αντιστοίχιση ανά kind', () => {
    expect(FOUNDATION_IFC_MAP.pad).toBe('PAD_FOOTING');
    expect(FOUNDATION_IFC_MAP.strip).toBe('STRIP_FOOTING');
    expect(FOUNDATION_IFC_MAP['tie-beam']).toBe('FOOTING_BEAM');
  });
});
