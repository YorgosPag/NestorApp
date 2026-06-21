/**
 * Tests — ADR-510 Φ2A unified catalog + aliases.
 */

import {
  LINETYPE_CATALOG_NAMES,
  LINETYPE_ISO_NAMES,
  LINETYPE_ISO_CATALOG,
  isIsoBaselineLinetype,
  isCatalogLinetype,
  getCatalogLinetype,
  listAllLinetypes,
  listIsoLinetypes,
} from '../linetype-iso-catalog';
import {
  resolveAnyLinetype,
  resolveAnyDashMm,
  BIM_KEY_TO_LINETYPE,
  LEGACY_ENUM_TO_LINETYPE,
} from '../linetype-aliases';
import { BIM_LINE_PATTERNS } from '../bim-line-patterns';

describe('catalog completeness', () => {
  it('every catalog name has a frozen LinetypeDef', () => {
    for (const name of LINETYPE_CATALOG_NAMES) {
      const def = LINETYPE_ISO_CATALOG[name];
      expect(def).toBeDefined();
      expect(def.name).toBe(name);
      expect(Array.isArray(def.pattern)).toBe(true);
    }
  });

  it('keeps the strict 8 ISO baseline subset', () => {
    expect(LINETYPE_ISO_NAMES.length).toBe(8);
    expect(listIsoLinetypes().length).toBe(8);
  });

  it('listAllLinetypes covers the full 28-entry catalog', () => {
    expect(listAllLinetypes().length).toBe(LINETYPE_CATALOG_NAMES.length);
    // 8 ISO base + 14 density variants + 3 Dot family + 2 BIM specials = 27.
    expect(LINETYPE_CATALOG_NAMES.length).toBe(27);
  });

  it('isIsoBaselineLinetype is true for standard acadiso, false for BIM specials', () => {
    expect(isIsoBaselineLinetype('Dashed')).toBe(true);
    expect(isIsoBaselineLinetype('Dashed2')).toBe(true); // variant = standard
    expect(isIsoBaselineLinetype('Dot')).toBe(true);
    expect(isIsoBaselineLinetype('Double')).toBe(false); // bim-special → needs LTYPE entry
    expect(isIsoBaselineLinetype('Zigzag')).toBe(false);
    expect(isIsoBaselineLinetype('Nonexistent')).toBe(false);
  });

  it('isCatalogLinetype is true for any built-in (incl. specials)', () => {
    expect(isCatalogLinetype('Double')).toBe(true);
    expect(isCatalogLinetype('Zigzag')).toBe(true);
    expect(isCatalogLinetype('custom_foo')).toBe(false);
  });

  it('Continuous is solid (empty pattern)', () => {
    expect(getCatalogLinetype('Continuous')?.pattern).toEqual([]);
  });
});

describe('resolveAnyLinetype', () => {
  it('resolves every one of the 28 BIM pattern keys to a catalog def', () => {
    for (const key of BIM_LINE_PATTERNS) {
      const def = resolveAnyLinetype(key);
      expect(def).not.toBeNull();
      expect(isCatalogLinetype(def!.name)).toBe(true);
    }
  });

  it('every BIM_KEY_TO_LINETYPE target exists in the catalog', () => {
    for (const target of Object.values(BIM_KEY_TO_LINETYPE)) {
      expect(isCatalogLinetype(target)).toBe(true);
    }
  });

  it('every LEGACY_ENUM_TO_LINETYPE target exists in the catalog', () => {
    for (const target of Object.values(LEGACY_ENUM_TO_LINETYPE)) {
      expect(isCatalogLinetype(target)).toBe(true);
    }
  });

  it('resolves canonical names directly (case-sensitive)', () => {
    expect(resolveAnyLinetype('Center2')?.name).toBe('Center2');
  });

  it('resolves legacy enums (lowercase)', () => {
    expect(resolveAnyLinetype('dash-dot')?.name).toBe('DashDot');
    expect(resolveAnyLinetype('dash-dot-dot')?.name).toBe('Divide');
    expect(resolveAnyLinetype('solid')?.name).toBe('Continuous');
  });

  it('resolves case-variant DXF names', () => {
    expect(resolveAnyLinetype('DASHED')?.name).toBe('Dashed');
    expect(resolveAnyLinetype('hidden')?.name).toBe('Hidden');
  });

  it('returns null for unknown / custom names', () => {
    expect(resolveAnyLinetype('custom_foo')).toBeNull();
    expect(resolveAnyLinetype('')).toBeNull();
    expect(resolveAnyLinetype(null)).toBeNull();
  });

  it('resolveAnyDashMm returns [] for unknown and Continuous', () => {
    expect(resolveAnyDashMm('custom_x')).toEqual([]);
    expect(resolveAnyDashMm('Continuous')).toEqual([]);
    expect(resolveAnyDashMm('Dashed').length).toBeGreaterThan(0);
  });

  // ADR-510 Φ2E — DxfRenderer.resolveStyleForRender's layer-less fallback feeds an
  // entity's own `linetypeName` straight into resolveAnyDashMm. The cascade
  // sentinels (ByLayer/ByBlock) + empty/undefined MUST resolve to solid here, so
  // the entity's concrete linetype still renders dashed without a layer context.
  it('resolveAnyDashMm returns [] for cascade sentinels + empty (entity-own fallback)', () => {
    expect(resolveAnyDashMm('ByLayer')).toEqual([]);
    expect(resolveAnyDashMm('ByBlock')).toEqual([]);
    expect(resolveAnyDashMm('')).toEqual([]);
    expect(resolveAnyDashMm(undefined)).toEqual([]);
    expect(resolveAnyDashMm(null)).toEqual([]);
  });

  it('resolveAnyDashMm resolves a concrete entity linetype to its pattern (DashDot)', () => {
    expect(resolveAnyDashMm('DashDot').length).toBeGreaterThan(0);
  });
});
