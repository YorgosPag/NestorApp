/**
 * ADR-363 Phase 8E — Section catalog: preset lookup + custom-sentinel tests.
 */

import {
  CATALOG_CUSTOM_SENTINEL,
  ISHAPE_CATALOG,
  SHEAR_WALL_CATALOG,
  findIShapePreset,
  findShearWallPreset,
} from '../section-catalog';

// ─── Shear-wall catalog ───────────────────────────────────────────────────────

describe('SHEAR_WALL_CATALOG', () => {
  it('has 5 Eurocode 2 concrete classes', () => {
    expect(SHEAR_WALL_CATALOG).toHaveLength(5);
  });

  it('all presets have positive thickness', () => {
    for (const p of SHEAR_WALL_CATALOG) {
      expect(p.thickness).toBeGreaterThan(0);
    }
  });

  it('all preset IDs are unique', () => {
    const ids = SHEAR_WALL_CATALOG.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all presets have labelKey strings', () => {
    for (const p of SHEAR_WALL_CATALOG) {
      expect(typeof p.labelKey).toBe('string');
      expect(p.labelKey.length).toBeGreaterThan(0);
    }
  });

  it('C25/30 is default mid-rise (200mm)', () => {
    const p = SHEAR_WALL_CATALOG.find((x) => x.id === 'C25/30');
    expect(p?.thickness).toBe(200);
  });

  it('C40/50 has thickest wall (300mm)', () => {
    const p = SHEAR_WALL_CATALOG.find((x) => x.id === 'C40/50');
    expect(p?.thickness).toBe(300);
  });
});

// ─── I-shape catalog ─────────────────────────────────────────────────────────

describe('ISHAPE_CATALOG', () => {
  it('has 10 sections (6 IPE + 4 HEA)', () => {
    expect(ISHAPE_CATALOG).toHaveLength(10);
    const ipe = ISHAPE_CATALOG.filter((p) => p.id.startsWith('IPE'));
    const hea = ISHAPE_CATALOG.filter((p) => p.id.startsWith('HEA'));
    expect(ipe).toHaveLength(6);
    expect(hea).toHaveLength(4);
  });

  it('all preset IDs are unique', () => {
    const ids = ISHAPE_CATALOG.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all dimensions are positive', () => {
    for (const p of ISHAPE_CATALOG) {
      expect(p.flangeWidth).toBeGreaterThan(0);
      expect(p.sectionDepth).toBeGreaterThan(0);
      expect(p.flangeThickness).toBeGreaterThan(0);
      expect(p.webThickness).toBeGreaterThan(0);
    }
  });

  it('flange thickness > web thickness (typical for I-sections)', () => {
    for (const p of ISHAPE_CATALOG) {
      expect(p.flangeThickness).toBeGreaterThan(p.webThickness);
    }
  });

  it('IPE-300 matches EN 10025-2 table values', () => {
    const p = ISHAPE_CATALOG.find((x) => x.id === 'IPE-300');
    expect(p).toBeDefined();
    expect(p?.flangeWidth).toBe(150);
    expect(p?.sectionDepth).toBe(300);
    expect(p?.flangeThickness).toBe(10.7);
    expect(p?.webThickness).toBe(7.1);
  });

  it('HEA-300 matches EN 10025-2 table values', () => {
    const p = ISHAPE_CATALOG.find((x) => x.id === 'HEA-300');
    expect(p).toBeDefined();
    expect(p?.flangeWidth).toBe(300);
    expect(p?.sectionDepth).toBe(290);
    expect(p?.flangeThickness).toBe(14.0);
    expect(p?.webThickness).toBe(8.5);
  });
});

// ─── findShearWallPreset ──────────────────────────────────────────────────────

describe('findShearWallPreset', () => {
  it('returns preset for known ID', () => {
    const p = findShearWallPreset('C25/30');
    expect(p).not.toBeNull();
    expect(p?.id).toBe('C25/30');
  });

  it('returns null for unknown ID', () => {
    expect(findShearWallPreset('C50/60')).toBeNull();
  });

  it('returns null for custom sentinel', () => {
    expect(findShearWallPreset(CATALOG_CUSTOM_SENTINEL)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(findShearWallPreset('')).toBeNull();
  });
});

// ─── findIShapePreset ─────────────────────────────────────────────────────────

describe('findIShapePreset', () => {
  it('returns preset for known IPE ID', () => {
    const p = findIShapePreset('IPE-400');
    expect(p).not.toBeNull();
    expect(p?.id).toBe('IPE-400');
  });

  it('returns preset for known HEA ID', () => {
    const p = findIShapePreset('HEA-200');
    expect(p).not.toBeNull();
    expect(p?.id).toBe('HEA-200');
  });

  it('returns null for unknown ID', () => {
    expect(findIShapePreset('IPE-600')).toBeNull();
  });

  it('returns null for custom sentinel', () => {
    expect(findIShapePreset(CATALOG_CUSTOM_SENTINEL)).toBeNull();
  });
});

// ─── CATALOG_CUSTOM_SENTINEL ──────────────────────────────────────────────────

describe('CATALOG_CUSTOM_SENTINEL', () => {
  it('is the string "custom"', () => {
    expect(CATALOG_CUSTOM_SENTINEL).toBe('custom');
  });

  it('is not a valid shear-wall preset ID', () => {
    expect(findShearWallPreset(CATALOG_CUSTOM_SENTINEL)).toBeNull();
  });

  it('is not a valid I-shape preset ID', () => {
    expect(findIShapePreset(CATALOG_CUSTOM_SENTINEL)).toBeNull();
  });
});
