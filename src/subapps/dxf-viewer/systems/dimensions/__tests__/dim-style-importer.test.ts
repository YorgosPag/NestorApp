/**
 * ADR-362 Round 5 — `dim-style-importer` tests.
 *
 * Covers the contractual responsibilities of `registerImportedDimStyles`:
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
 *   4. DIMSCALE storage — AutoCAD DIMSCALE is dimensionless and stored as-is.
 *      The renderer formula (dimtxt × dimscale × mmToSceneUnits × viewScale)
 *      already applies the unit factor, so no pre-normalization is needed.
 *      Annotative sentinel (dimscale=0) resolves to headerDimscale.
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

function makeSceneWithUnits(
  dimStyles: Record<string, ImportedSceneDimStyle>,
  units: SceneModel['units'],
  headerDimscale?: number,
  bounds?: SceneModel['bounds'],
): Pick<SceneModel, 'dimStyles' | 'units'> & { headerDimscale?: number; bounds?: SceneModel['bounds'] } {
  return { dimStyles, units, ...(headerDimscale !== undefined ? { headerDimscale } : {}), ...(bounds !== undefined ? { bounds } : {}) };
}

const METERS_BOUNDS: SceneModel['bounds'] = { min: { x: -21, y: -15 }, max: { x: 0, y: 0 } };

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

// ──────────────────────────────────────────────────────────────────────────────
// DIMSCALE storage — as-is (no normalization)
// ──────────────────────────────────────────────────────────────────────────────

describe('registerImportedDimStyles — dimscale storage', () => {
  let registry: DimStyleRegistry;
  beforeEach(() => { registry = new DimStyleRegistry(); });

  it('stores dimscale as-is for mm scene (dimensionless 100 → stored 100)', () => {
    // AutoCAD DIMSCALE is dimensionless. Renderer formula applies mmToSceneUnits
    // itself, so no pre-normalization. mm scene: 2.5×100×1×vs = 250×vs (correct).
    const result = registerImportedDimStyles(
      makeSceneWithUnits({ Standard: makeImportedStyle({ dimscale: 100 }) }, 'mm'),
      registry,
    );
    const style = registry.getStyle(result.created[0]);
    expect(style?.dimscale).toBeCloseTo(100, 6);
  });

  it('stores dimscale as-is for m scene (dimensionless 100 → stored 100)', () => {
    // m scene: renderer formula 2.5×100×0.001×vs = 0.25×vs — matches native
    // DXF TEXT at 0.25m height. No normalization needed.
    const result = registerImportedDimStyles(
      makeSceneWithUnits({ Standard: makeImportedStyle({ dimscale: 100 }) }, 'm'),
      registry,
    );
    const style = registry.getStyle(result.created[0]);
    expect(style?.dimscale).toBeCloseTo(100, 6);
  });

  it('annotative sentinel dimscale=0 resolves to headerDimscale (stored as-is)', () => {
    // dimscale=0 → annotative sentinel → use headerDimscale=100 directly.
    const result = registerImportedDimStyles(
      makeSceneWithUnits({ Standard: makeImportedStyle({ dimscale: 0 }) }, 'mm', 100),
      registry,
    );
    const style = registry.getStyle(result.created[0]);
    expect(style?.dimscale).toBeCloseTo(100, 6);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// R14/R15 — DIMSCALE passthrough. The annotation-scale rescue (built-in/imported
// dimscale=1 → drawingScale SSoT, imported >1 wins) is centralised render-side in
// `resolveEffectiveDimscale` (see annotation-scale.test.ts). The importer must NOT
// rescue at import time — it stores the imported DIMSCALE verbatim. (The old R12
// import-time rescue was removed: it duplicated that logic AND was dead under
// ADR-462, where resolveSceneUnits trusts the declared unit.)
// ──────────────────────────────────────────────────────────────────────────────

describe('registerImportedDimStyles — DIMSCALE passthrough (rescue is render-side)', () => {
  let registry: DimStyleRegistry;
  beforeEach(() => { registry = new DimStyleRegistry(); });

  it('stores imported dimscale=1 verbatim even with meter-scale bounds (no import-time rescue)', () => {
    const result = registerImportedDimStyles(
      makeSceneWithUnits({ Standard: makeImportedStyle({ dimscale: 1 }) }, 'mm', undefined, METERS_BOUNDS),
      registry,
    );
    expect(registry.getStyle(result.created[0])?.dimscale).toBe(1);
  });

  it('stores an explicit imported dimscale=100 verbatim', () => {
    const result = registerImportedDimStyles(
      makeSceneWithUnits({ Standard: makeImportedStyle({ dimscale: 100 }) }, 'mm', undefined, METERS_BOUNDS),
      registry,
    );
    expect(registry.getStyle(result.created[0])?.dimscale).toBe(100);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Incident 2026-07-20 — «υπερμεγέθη κείμενα διαστάσεων»
//
// Ground truth: `Αδείας.Κάτοψη ισογείου.dxf` (metres, $EXTMIN/MAX 74.66 × 40.58).
// Its DIMSTYLE table, read straight off the file:
//
//     CHRIS 0.085/1 · STANDARD 0.18/1 · STAIRS_I 0.09375/96
//     ANNOTATIVE 0.09375/0 · CHRIS$0 0.085/1 · TEO 0.3/1
//
// Two independent defects stacked, the first masking the second:
//   (Α) AutoCAD writes `STANDARD`; the election compared `=== 'Standard'` and
//       never matched, so a synthetic 2.5 paper-mm default won instead.
//   (Β) DIMTXT is in DRAWING units, but `DimStyle`/`paperHeightToModel` expect
//       paper-mm — verbatim copying is off by 1000 in a metres file.
// Fixing (Α) alone would have swapped giant text for invisible text.
// ──────────────────────────────────────────────────────────────────────────────

describe('registerImportedDimStyles — drawing units → paper-mm (incident 2026-07-20)', () => {
  let registry: DimStyleRegistry;
  beforeEach(() => { registry = new DimStyleRegistry(); });

  it('converts metre-authored DIMTXT to its paper-mm equivalent', () => {
    const result = registerImportedDimStyles(
      makeSceneWithUnits({ CHRIS: makeImportedStyle({ name: 'CHRIS', dimtxt: 0.085 }) }, 'm'),
      registry,
    );
    // 0.085 m of drawing → 85 paper-mm, so paperHeightToModel(85, 1, 'm') = 0.085 m.
    expect(registry.getStyle(result.created[0])?.dimtxt).toBeCloseTo(85, 6);
  });

  it('leaves mm-authored DIMTXT untouched (factor is exactly 1)', () => {
    const result = registerImportedDimStyles(
      makeSceneWithUnits({ Standard: makeImportedStyle({ dimtxt: 2.5 }) }, 'mm'),
      registry,
    );
    expect(registry.getStyle(result.created[0])?.dimtxt).toBe(2.5);
  });

  it('converts every size field, not just DIMTXT', () => {
    const result = registerImportedDimStyles(
      makeSceneWithUnits(
        { S: makeImportedStyle({ name: 'S', dimasz: 0.1, dimgap: 0.02, dimexe: 0.05, dimexo: 0.03, dimdli: 0.4, dimcen: 0.09 }) },
        'm',
      ),
      registry,
    );
    const style = registry.getStyle(result.created[0]);
    expect(style?.dimasz).toBeCloseTo(100, 6);
    expect(style?.dimgap).toBeCloseTo(20, 6);
    expect(style?.dimexe).toBeCloseTo(50, 6);
    expect(style?.dimexo).toBeCloseTo(30, 6);
    expect(style?.dimdli).toBeCloseTo(400, 6);
    expect(style?.dimcen).toBeCloseTo(90, 6);
    expect(style?.breakGap).toBeCloseTo(150, 6);
  });

  it('does NOT rescale measurement-space fields (DIMRND / DIMTM / DIMTP / DIMLFAC)', () => {
    const result = registerImportedDimStyles(
      makeSceneWithUnits({ S: makeImportedStyle({ name: 'S', dimrnd: 0.05, dimtm: 0.01, dimtp: 0.02, dimlfac: 1 }) }, 'm'),
      registry,
    );
    const style = registry.getStyle(result.created[0]);
    expect(style?.dimrnd).toBe(0.05);
    expect(style?.dimtm).toBe(0.01);
    expect(style?.dimtp).toBe(0.02);
    expect(style?.dimlfac).toBe(1);
  });

  it('elects the uppercase AutoCAD "STANDARD" as active', () => {
    const result = registerImportedDimStyles(
      makeSceneWithUnits(
        {
          CHRIS: makeImportedStyle({ name: 'CHRIS', dimtxt: 0.085 }),
          STANDARD: makeImportedStyle({ name: 'STANDARD', dimtxt: 0.18 }),
          TEO: makeImportedStyle({ name: 'TEO', dimtxt: 0.3 }),
        },
        'm',
      ),
      registry,
    );
    expect(result.activeChanged).toBe(true);
    const active = registry.getActiveStyle();
    expect(active.name).toBe('imported:STANDARD');
    // 0.18 m text, NOT the 2.5 paper-mm phantom that used to win this election.
    expect(active.dimtxt).toBeCloseTo(180, 6);
  });

  it('flags a file-declared DIMSCALE as explicit, and the annotative sentinel as not', () => {
    const result = registerImportedDimStyles(
      makeSceneWithUnits(
        {
          CHRIS: makeImportedStyle({ name: 'CHRIS', dimscale: 1 }),
          ANNOTATIVE: makeImportedStyle({ name: 'ANNOTATIVE', dimscale: 0 }),
        },
        'm',
        1,
      ),
      registry,
    );
    const [chris, annotative] = result.created.map((id) => registry.getStyle(id));
    expect(chris?.dimscaleExplicit).toBe(true);
    expect(annotative?.dimscaleExplicit).toBe(false);
  });
});
