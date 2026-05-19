/**
 * ADR-362 Round 5 — `dim-style-importer` reconciliation tests.
 *
 * Covers the three contractual responsibilities of `registerImportedDimStyles`:
 *
 *   1. Translation — raw `DimStyleEntry` (DXF codes) → runtime `DimStyle`
 *      (string enums + Round 5 fields). DIMTXT values land verbatim so newly
 *      created ribbon dims pick up the source DXF's text height.
 *   2. Reconciliation — previously-imported entries are removed before the
 *      new ones are added; built-in templates (ISO_129, ASME, Arch) are
 *      untouched across consecutive imports.
 *   3. Active style selection — `Standard` (when present) becomes active so
 *      ribbon dim creation defaults to the source's primary style; otherwise
 *      the first imported entry in iteration order.
 */

import { registerImportedDimStyles } from '../dim-style-importer';
import { DimStyleRegistry } from '../dim-style-registry';
import type { ImportedSceneDimStyle, SceneModel } from '../../../types/scene-types';

// ──────────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────────

function makeImportedStyle(overrides: Partial<ImportedSceneDimStyle> = {}): ImportedSceneDimStyle {
  return {
    name: 'Standard',
    dimscale: 1, dimasz: 2.5, dimexo: 0.625, dimdli: 3.75, dimexe: 1.25,
    dimrnd: 0, dimtp: 0, dimtm: 0,
    dimtxt: 2.5, dimcen: 2.5, dimaltf: 25.4, dimlfac: 1, dimtfac: 1,
    dimgap: 0.625, dimaltrnd: 0,
    dimtol: false, dimlim: false, dimtih: true, dimtoh: true,
    suppressExtLine1: false, suppressExtLine2: false,
    dimtad: 1, dimzin: 0,
    dimalt: false, dimaltd: 2, dimtofl: false, dimtix: false,
    dimclrd: 0, dimclre: 0, dimclrt: 0, dimadec: 0,
    dimlunit: 2, dimdec: 4, dimtdec: 4, dimaltu: 2,
    dimaunit: 0, dimdsep: 46, dimtmove: 0,
    suppressDimLine1: false, suppressDimLine2: false,
    dimtolj: 1, dimatfit: 3,
    ...overrides,
  };
}

function makeScene(dimStyles: Record<string, ImportedSceneDimStyle> | undefined): Pick<SceneModel, 'dimStyles'> {
  return { dimStyles };
}

// ──────────────────────────────────────────────────────────────────────────────
// Translation
// ──────────────────────────────────────────────────────────────────────────────

describe('registerImportedDimStyles — translation', () => {
  let registry: DimStyleRegistry;
  beforeEach(() => { registry = new DimStyleRegistry(); });

  it('preserves DIMTXT / DIMASZ / DIMGAP from the imported entry verbatim', () => {
    const result = registerImportedDimStyles(
      makeScene({ Standard: makeImportedStyle({ dimtxt: 1.5, dimasz: 3.0, dimgap: 0.9 }) }),
      registry,
    );

    expect(result.created).toHaveLength(1);
    const style = registry.getStyle(result.created[0]);
    expect(style?.dimtxt).toBe(1.5);
    expect(style?.dimasz).toBe(3.0);
    expect(style?.dimgap).toBe(0.9);
  });

  it('maps DIMLUNIT code 2 → "decimal" and DIMDSEP 44 → ","', () => {
    const result = registerImportedDimStyles(
      makeScene({ Custom: makeImportedStyle({ dimlunit: 2, dimdsep: 44 }) }),
      registry,
    );

    const style = registry.getStyle(result.created[0]);
    expect(style?.dimlunit).toBe('decimal');
    expect(style?.dimdsep).toBe(',');
  });

  it('namespaces imported styles with the "imported:" prefix', () => {
    const result = registerImportedDimStyles(
      makeScene({ Standard: makeImportedStyle() }),
      registry,
    );

    const style = registry.getStyle(result.created[0]);
    expect(style?.name).toBe('imported:Standard');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Reconciliation
// ──────────────────────────────────────────────────────────────────────────────

describe('registerImportedDimStyles — reconciliation', () => {
  let registry: DimStyleRegistry;
  beforeEach(() => { registry = new DimStyleRegistry(); });

  it('removes the previous import\'s entries before adding the new ones', () => {
    const first = registerImportedDimStyles(
      makeScene({ Standard: makeImportedStyle({ dimtxt: 1 }) }),
      registry,
    );
    expect(first.removed).toHaveLength(0);
    expect(first.created).toHaveLength(1);

    const second = registerImportedDimStyles(
      makeScene({ Custom: makeImportedStyle({ name: 'Custom', dimtxt: 4 }) }),
      registry,
    );
    expect(second.removed).toEqual(first.created);
    expect(second.created).toHaveLength(1);

    // After reconciliation only the new custom + the 3 built-ins remain.
    const remaining = registry.getAllStyles();
    const customs = remaining.filter((s) => !s.isBuiltIn);
    expect(customs).toHaveLength(1);
    expect(customs[0].name).toBe('imported:Custom');
  });

  it('never touches built-in templates', () => {
    const before = registry.getAllStyles().filter((s) => s.isBuiltIn);
    registerImportedDimStyles(makeScene({ Standard: makeImportedStyle() }), registry);
    registerImportedDimStyles(makeScene({ A: makeImportedStyle({ name: 'A' }) }), registry);
    const after = registry.getAllStyles().filter((s) => s.isBuiltIn);
    expect(after).toEqual(before);
  });

  it('returns empty arrays when the scene has no dimStyles', () => {
    const result = registerImportedDimStyles(makeScene(undefined), registry);
    expect(result.created).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.activeChanged).toBe(false);
  });

  it('removes stale imported entries even when the new scene has none', () => {
    const seeded = registerImportedDimStyles(
      makeScene({ Standard: makeImportedStyle() }),
      registry,
    );

    const wiped = registerImportedDimStyles(makeScene(undefined), registry);
    expect(wiped.removed).toEqual(seeded.created);
    expect(wiped.created).toEqual([]);

    // Built-ins survive; no leftover customs.
    expect(registry.getAllStyles().filter((s) => !s.isBuiltIn)).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Active selection
// ──────────────────────────────────────────────────────────────────────────────

describe('registerImportedDimStyles — active style', () => {
  let registry: DimStyleRegistry;
  beforeEach(() => { registry = new DimStyleRegistry(); });

  it('activates the imported "Standard" when present', () => {
    const result = registerImportedDimStyles(
      makeScene({
        First: makeImportedStyle({ name: 'First' }),
        Standard: makeImportedStyle({ dimtxt: 1.5 }),
      }),
      registry,
    );

    expect(result.activeChanged).toBe(true);
    const active = registry.getActiveStyle();
    expect(active.name).toBe('imported:Standard');
    expect(active.dimtxt).toBe(1.5);
  });

  it('falls back to the first imported entry when no "Standard" exists', () => {
    const result = registerImportedDimStyles(
      makeScene({ Alpha: makeImportedStyle({ name: 'Alpha', dimtxt: 7 }) }),
      registry,
    );

    expect(result.activeChanged).toBe(true);
    expect(registry.getActiveStyle().name).toBe('imported:Alpha');
  });
});
