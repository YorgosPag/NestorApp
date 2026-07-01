/**
 * ADR-362 Round 5 — Import-time DIMSTYLE → registry seeder (SSoT).
 *
 * The DXF parser populates `SceneModel.dimStyles` with the raw DIMSTYLE table
 * read from the file's TABLES section. Until Round 5 this map was consumed only
 * by `dxf-dimension-converter.ts` when computing per-entity text height for
 * IMPORTED dimensions; the runtime `DimStyleRegistry` (which feeds new Ribbon
 * dims via `useDimensionCreate`) never saw it. Result: a user who opened a DXF
 * authored with `DIMTXT = 1.5` would still create new dims at the ISO_129
 * default of `2.5` — a visible "wrong size" bug that surfaced together with
 * the meters-scene scaling issue.
 *
 * Single point of truth for the file → registry projection. Two responsibilities:
 *
 *   1. **Translate** the raw `ImportedSceneDimStyle` (DimStyleEntry-shaped,
 *      AutoCAD code-driven enums) into the runtime `DimStyle` interface
 *      (string-keyed enums + Round 5 fields like `paperTextHeight`, `dimblk`).
 *      AutoCAD DIMSCALE is dimensionless (e.g. 100 for 1:100 regardless of
 *      model units), so it is stored verbatim. The renderer formula
 *      `dimtxt × dimscale × mmToSceneUnits × viewScale` applies the unit
 *      factor itself — no pre-normalization is needed or correct here.
 *   2. **Reconcile** registry state on every (re)import: previous
 *      session-imported styles are removed before the new ones are added so
 *      switching between DXFs doesn't leak stale entries. Built-in templates
 *      (ISO_129, ASME Y14.5, Architectural US) are never touched.
 *
 * Idempotent for the same `SceneModel.dimStyles` snapshot — calling
 * `registerImportedDimStyles()` twice in a row with the same input produces
 * the same registry state.
 */

import type { SceneModel, ImportedSceneDimStyle } from '../../types/scene-types';
import type {
  DimStyle,
  DimLinearUnitFormat,
  DimAngularUnitFormat,
  DimTextVerticalPlacement,
  DimToleranceJustify,
  DimTextFillMode,
  DimInspectionMode,
} from '../../types/dimension';
import {
  type DimStyleRegistry,
  type CreateCustomStyleInput,
  getDimStyleRegistry,
} from './dim-style-registry';

// ──────────────────────────────────────────────────────────────────────────────
// Provenance tag
// ──────────────────────────────────────────────────────────────────────────────

const IMPORT_NAME_PREFIX = 'imported:';

/**
 * Returns true when the given style was created via `registerImportedDimStyles`.
 * Identified by the namespaced `imported:<source>` name prefix so reconciliation
 * can wipe just the previously-imported entries without touching user customs.
 */
function isImportedStyle(style: DimStyle): boolean {
  return !style.isBuiltIn && style.name.startsWith(IMPORT_NAME_PREFIX);
}

// ──────────────────────────────────────────────────────────────────────────────
// Enum translation tables — AutoCAD code values → runtime string enums
// ──────────────────────────────────────────────────────────────────────────────

// DIMLUNIT: 1=scientific, 2=decimal, 3=engineering, 4=architectural, 5=fractional, 6=Windows.
const DIMLUNIT_MAP: Record<number, DimLinearUnitFormat> = {
  1: 'scientific',
  2: 'decimal',
  3: 'engineering',
  4: 'architectural',
  5: 'fractional',
  6: 'windowsDesktop',
};

// DIMAUNIT: 0=decimalDegrees, 1=DMS, 2=gradians, 3=radians, 4=surveyor.
const DIMAUNIT_MAP: Record<number, DimAngularUnitFormat> = {
  0: 'decimalDegrees',
  1: 'degMinSec',
  2: 'gradians',
  3: 'radians',
  4: 'surveyorUnits',
};

// DIMTAD: 0=centered, 1=above, 2=outside, 3=jis, 4=below.
const DIMTAD_MAP: Record<number, DimTextVerticalPlacement> = {
  0: 'centered',
  1: 'above',
  2: 'outside',
  3: 'jis',
  4: 'below',
};

// DIMTOLJ: 0=bottom, 1=middle, 2=top.
const DIMTOLJ_MAP: Record<number, DimToleranceJustify> = {
  0: 'bottom',
  1: 'middle',
  2: 'top',
};

// ──────────────────────────────────────────────────────────────────────────────
// Translation
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Maps a raw `ImportedSceneDimStyle` to the runtime `DimStyle` shape consumed
 * by the registry. Fields with no direct DXF equivalent (annotative scale,
 * DIMTFILL, inspection markers, breakGap) are seeded with the same defaults as
 * the ISO_129 built-in template — they remain user-editable post-import.
 */
function translateToDimStyle(
  entry: ImportedSceneDimStyle,
  sourceLabel: string,
  headerDimscale: number,
): CreateCustomStyleInput {
  // AutoCAD DIMSCALE is dimensionless (e.g. 100 for 1:100 regardless of
  // model units). The renderer formula already applies mmToSceneUnits, so
  // storing rawDimscale directly produces unit-correct output for both mm
  // and m scenes. DIMSCALE=0 is the AutoCAD "annotative" sentinel — fall
  // back to the global $DIMSCALE from the file header.
  const rawDimscale = entry.dimscale === 0 ? headerDimscale : entry.dimscale;
  const decSep = entry.dimdsep === 44 ? ',' : '.';
  const dimtad = DIMTAD_MAP[entry.dimtad] ?? 'above';
  const dimlunit = DIMLUNIT_MAP[entry.dimlunit] ?? 'decimal';
  const dimaunit = DIMAUNIT_MAP[entry.dimaunit] ?? 'decimalDegrees';
  const dimaltu = DIMLUNIT_MAP[entry.dimaltu] ?? 'decimal';
  const dimtolj = DIMTOLJ_MAP[entry.dimtolj] ?? 'middle';
  const dimtfill: DimTextFillMode = 'none';
  const dimInspect: DimInspectionMode = 'off';

  return {
    name: `${IMPORT_NAME_PREFIX}${sourceLabel}`,

    // Lines & extensions
    dimclrd: entry.dimclrd,
    dimclre: entry.dimclre,
    // ADR-562 Φ1 — DXF DIMLWD/DIMLWE (371/372) + DIMLTYPE/DIMLTEX1/DIMLTEX2
    // (345/346/347) are not parsed yet (writer/importer round-trip = future Φ6);
    // seed ByLayer like the other no-DXF-equivalent fields above. `arrowColor`
    // omitted → inherits dimclrd.
    dimlwd: -2,
    dimlwe: -2,
    dimltype: 'ByLayer',
    dimltex1: 'ByLayer',
    dimltex2: 'ByLayer',
    dimexe: entry.dimexe,
    dimexo: entry.dimexo,
    dimdli: entry.dimdli,
    suppressDimLine1: entry.suppressDimLine1,
    suppressDimLine2: entry.suppressDimLine2,
    suppressExtLine1: entry.suppressExtLine1,
    suppressExtLine2: entry.suppressExtLine2,

    // Symbols & arrows
    dimasz: entry.dimasz,
    dimblk: 'closedFilled',
    dimblk1: '',
    dimblk2: '',
    dimcen: entry.dimcen,
    breakGap: entry.dimexe * 3,

    // Text
    dimtxt: entry.dimtxt,
    dimclrt: entry.dimclrt,
    dimgap: entry.dimgap,
    dimtad,
    dimtih: entry.dimtih,
    dimtoh: entry.dimtoh,
    dimtfill,
    dimtfillclr: 0,
    textFontFamily: 'Arial',

    // Fit
    dimtix: entry.dimtix,
    dimtofl: entry.dimtofl,
    dimatfit: entry.dimatfit,
    dimtmove: entry.dimtmove,
    dimscale: rawDimscale,
    paperTextHeight: entry.dimtxt,

    // Primary units
    dimlunit,
    dimaunit,
    dimdec: entry.dimdec,
    dimadec: entry.dimadec,
    dimdsep: decSep,
    dimpost: '',
    dimrnd: entry.dimrnd,
    dimlfac: entry.dimlfac,
    dimzin: entry.dimzin,

    // Alternate units
    dimalt: entry.dimalt,
    dimaltu,
    dimaltf: entry.dimaltf,
    dimaltd: entry.dimaltd,
    dimaltrnd: entry.dimaltrnd,
    dimapost: '',

    // Tolerances
    dimtol: entry.dimtol,
    dimlim: entry.dimlim,
    dimtm: entry.dimtm,
    dimtp: entry.dimtp,
    dimtdec: entry.dimtdec,
    dimtfac: entry.dimtfac,
    dimtolj,

    // Inspection
    dimInspect,
    dimInspectRate: 100,

    // Associativity
    dimassoc: 2,

    // Layer / annotative — keep registry defaults; imported DXFs author dims on
    // whatever layer they choose; the active-layer picker drives placement of
    // new ribbon dims regardless of which DIMSTYLE is active.
    targetLayer: 'Dimensions',
    annotative: false,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

export interface RegisterImportedDimStylesResult {
  /** Registry IDs of styles created on this call. */
  readonly created: readonly string[];
  /** Registry IDs of stale imported styles wiped before the call. */
  readonly removed: readonly string[];
  /** The active style id after the call, if it changed. */
  readonly activeChanged: boolean;
}

/**
 * Seed the runtime `DimStyleRegistry` from a `SceneModel.dimStyles` map.
 *
 * Reconciliation rules:
 *   - Every existing custom style tagged with the `imported:` prefix is removed
 *     first so consecutive imports do not leak entries.
 *   - Each entry in `scene.dimStyles` is translated and registered as a new
 *     custom style.
 *   - The active style is set to the newly-registered `'Standard'` if present,
 *     otherwise to the first entry in iteration order. Falls back to whatever
 *     the registry's default is when the map is empty.
 *
 * Returning a structured result keeps the function unit-testable without
 * having to spy on the registry's subscriber list.
 */
export function registerImportedDimStyles(
  scene: (Pick<SceneModel, 'dimStyles'> & Partial<Pick<SceneModel, 'units' | 'headerDimscale' | 'bounds'>>) | null | undefined,
  registry: DimStyleRegistry = getDimStyleRegistry(),
): RegisterImportedDimStylesResult {
  const removed = removeImportedStyles(registry);
  if (!scene?.dimStyles) {
    return { created: [], removed, activeChanged: false };
  }

  const entries = Object.entries(scene.dimStyles);
  if (entries.length === 0) {
    return { created: [], removed, activeChanged: false };
  }

  const headerDimscale = scene.headerDimscale ?? 1;
  // ADR-362 R14/R15 — the dimscale annotation-scale rescue is centralised at the
  // single render point `resolveEffectiveDimscale` (utils/annotation-scale.ts):
  // imported DIMSCALE>1 wins, else the live `drawingScale` SSoT, unit-independent.
  // The old import-time R12 rescue was removed — it duplicated that logic AND had
  // become dead code under ADR-462 (resolveSceneUnits now trusts the declared unit,
  // so the "declared-mm-but-bounds-metres" conflict it keyed on never fires).

  const created: string[] = [];
  let standardId: string | null = null;
  let firstId: string | null = null;

  for (const [name, entry] of entries) {
    const input = translateToDimStyle(entry, name, headerDimscale);
    const style = registry.createCustomStyle(input);
    created.push(style.id);
    if (firstId === null) firstId = style.id;
    if (name === 'Standard' && standardId === null) standardId = style.id;
  }

  const nextActive = standardId ?? firstId;
  let activeChanged = false;
  if (nextActive && nextActive !== registry.getActiveStyleId()) {
    registry.setActiveStyleId(nextActive);
    activeChanged = true;
  }

  return { created, removed, activeChanged };
}

/** Test-friendly helper — removes all imported styles, returns their ids. */
function removeImportedStyles(registry: DimStyleRegistry): string[] {
  const ids: string[] = [];
  for (const style of registry.getAllStyles()) {
    if (isImportedStyle(style)) ids.push(style.id);
  }
  for (const id of ids) registry.deleteCustomStyle(id);
  return ids;
}
