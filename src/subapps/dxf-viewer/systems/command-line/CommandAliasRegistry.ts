// ADR-357 Phase 14-A — Command Alias Registry SSoT.
// ~150 ACAD-compatible aliases. User customization via localStorage.
// Pattern: pure module, zero React, zero state.

import { compareByLocale } from '@/lib/intl-formatting';
import type { ToolType } from '../../ui/toolbar/types';
// 🏢 ADR-092 — persistence via the storage-utils SSoT (SSR-safe + quota-guarded + JSON),
// not hand-rolled getItem/JSON.parse/setItem. Non-reactive read-modify-write per call.
import { storageGet, storageSet } from '../../utils/storage-utils';

const LS_CUSTOM_KEY = 'dxf:customAliases';

export interface AliasEntry {
  readonly alias: string;
  readonly toolId: ToolType;
  readonly isBuiltIn: boolean;
}

// Industry-standard AutoCAD/BricsCAD/nanoCAD command aliases.
// Aliases are ALWAYS ASCII — industry multilingual-safe standard.
const BUILT_IN: ReadonlyArray<readonly [string, ToolType]> = [
  // ── Selection ─────────────────────────────────────────────────────────────
  ['SEL',         'select'],
  // ── Line ──────────────────────────────────────────────────────────────────
  ['L',           'line'],
  ['LINE',        'line'],
  // ── Rectangle ─────────────────────────────────────────────────────────────
  ['R',           'rectangle'],
  ['REC',         'rectangle'],
  ['RECT',        'rectangle'],
  ['RECTANGLE',   'rectangle'],
  // ── Circle ────────────────────────────────────────────────────────────────
  ['C',           'circle'],
  ['CIR',         'circle'],
  ['CIRCLE',      'circle'],
  ['CD',          'circle-diameter'],
  ['C2P',         'circle-2p-diameter'],
  ['C3P',         'circle-3p'],
  ['CBF',         'circle-best-fit'],
  ['CTT',         'circle-ttt'],
  ['CCS',         'circle-chord-sagitta'],
  ['C2R',         'circle-2p-radius'],
  // ── Polyline ──────────────────────────────────────────────────────────────
  ['PL',          'polyline'],
  ['PO',          'polyline'],
  ['PLINE',       'polyline'],
  ['POLYLINE',    'polyline'],
  // ── Polygon ───────────────────────────────────────────────────────────────
  ['POL',         'polygon'],
  ['POLYGON',     'polygon'],
  // ── Ellipse ───────────────────────────────────────────────────────────────
  ['EL',          'ellipse'],
  ['ELLIPSE',     'ellipse'],
  // ── Arc ───────────────────────────────────────────────────────────────────
  ['A',           'arc'],
  ['ARC',         'arc'],
  ['A3',          'arc-3p'],
  ['ARC3P',       'arc-3p'],
  ['ACSE',        'arc-cse'],
  ['ASCE',        'arc-sce'],
  // ── Text ──────────────────────────────────────────────────────────────────
  ['T',           'text'],
  ['DT',          'text'],
  ['TEXT',        'text'],
  ['DTEXT',       'text'],
  ['MT',          'mtext'],
  ['MTEXT',       'mtext'],
  // ── Editing ───────────────────────────────────────────────────────────────
  ['M',           'move'],
  ['MO',          'move'],
  ['MOVE',        'move'],
  ['CO',          'copy'],
  ['CP',          'copy'],
  ['COPY',        'copy'],
  ['E',           'delete'],
  ['ER',          'delete'],
  ['DEL',         'delete'],
  ['ERASE',       'delete'],
  ['DELETE',      'delete'],
  ['RO',          'rotate'],
  ['ROTATE',      'rotate'],
  ['SC',          'scale'],
  ['SCALE',       'scale'],
  ['MI',          'mirror'],
  ['MIRROR',      'mirror'],
  ['S',           'stretch'],
  ['STR',         'stretch'],
  ['STRETCH',     'stretch'],
  ['MS',          'mstretch'],
  ['MSTRETCH',    'mstretch'],
  ['TR',          'trim'],
  ['TRIM',        'trim'],
  ['EX',          'extend'],
  ['EXTEND',      'extend'],
  ['OF',          'offset'],
  ['OFFSET',      'offset'],
  ['F',           'fillet'],
  ['FIL',         'fillet'],
  ['FILLET',      'fillet'],
  ['CHA',         'chamfer'],
  ['CHAMFER',     'chamfer'],
  ['AR',          'array-rect'],
  ['ARR',         'array-rect'],
  ['ARRAY',       'array-rect'],
  ['ARRAYRECT',   'array-rect'],
  ['AP',          'array-polar'],
  ['ARRAYPOLAR',  'array-polar'],
  ['CW',          'crop-window'],
  ['CROP',        'crop-window'],
  ['GE',          'grip-edit'],
  ['GRIPEDIT',    'grip-edit'],
  // ── Measurement ───────────────────────────────────────────────────────────
  ['DI',          'measure-distance'],
  ['DIST',        'measure-distance'],
  ['DISTANCE',    'measure-distance'],
  ['MDC',         'measure-distance-continuous'],
  ['AREA',        'measure-area'],
  ['AA',          'measure-area'],
  ['MEASUREAREA', 'measure-area'],
  ['MA',          'measure-angle'],
  ['MEASUREANGLE','measure-angle'],
  ['MR',          'measure-radius'],
  ['MRAD',        'measure-radius'],
  ['MPE',         'measure-perimeter'],
  ['MPERIMETER',  'measure-perimeter'],
  ['ME',          'measure'],
  ['MEASURE',     'measure'],
  // ── Zoom / Pan ────────────────────────────────────────────────────────────
  ['Z',           'zoom-extents'],
  ['ZE',          'zoom-extents'],
  ['ZA',          'zoom-extents'],
  ['ZF',          'zoom-extents'],
  ['ZOOM',        'zoom-extents'],
  ['ZI',          'zoom-in'],
  ['ZP',          'zoom-in'],
  ['ZOOMIN',      'zoom-in'],
  ['ZO',          'zoom-out'],
  ['ZM',          'zoom-out'],
  ['ZOOMOUT',     'zoom-out'],
  ['ZW',          'zoom-window'],
  ['ZOOMWINDOW',  'zoom-window'],
  ['P',           'pan'],
  ['PAN',         'pan'],
  // ── Dimensions (ADR-362) ──────────────────────────────────────────────────
  ['DIM',         'dim-smart'],
  ['DS',          'dim-smart'],
  ['DIMSMART',    'dim-smart'],
  ['DL',          'dim-linear'],
  ['DIMLIN',      'dim-linear'],
  ['DIMLINEAR',   'dim-linear'],
  ['DA',          'dim-aligned'],
  ['DIMALI',      'dim-aligned'],
  ['DIMALIGNED',  'dim-aligned'],
  ['DANG',        'dim-angular2L'],
  ['DIMANG',      'dim-angular2L'],
  ['DANG3',       'dim-angular3P'],
  ['DIMRAD',      'dim-radius'],
  ['DR',          'dim-radius'],
  ['DIMDIA',      'dim-diameter'],
  ['DD',          'dim-diameter'],
  ['DIMARC',      'dim-arc-length'],
  ['DIMARL',      'dim-arc-length'],
  ['DIMJOG',      'dim-jogged-radius'],
  ['DIMORD',      'dim-ordinate'],
  ['DORD',        'dim-ordinate'],
  ['DB',          'dim-baseline'],
  ['DIMBASE',     'dim-baseline'],
  ['DIMBASELINE', 'dim-baseline'],
  ['DC',          'dim-continued'],
  ['DIMCONT',     'dim-continued'],
  ['DIMCONTINUE', 'dim-continued'],
  // ── BIM (ADR-363) ─────────────────────────────────────────────────────────
  ['W',           'wall'],
  ['WALL',        'wall'],
  ['OP',          'opening'],
  ['O',           'opening'],
  ['OPENING',     'opening'],
  ['SL',          'slab'],
  ['SLAB',        'slab'],
  ['COL',         'column'],
  ['COLUMN',      'column'],
  ['BM',          'beam'],
  ['BEAM',        'beam'],
  ['ST',          'stair'],
  ['STAIR',       'stair'],
  // ── Utility / Layer ───────────────────────────────────────────────────────
  ['LA',          'layering'],
  ['LAY',         'layering'],
  ['LAYER',       'layering'],
  // ── Guide tools ───────────────────────────────────────────────────────────
  ['GU',          'guide-x'],
  ['GUIDE',       'guide-x'],
  ['GP',          'guide-parallel'],
  ['GD',          'guide-delete'],
  // ── Construction Lines (ADR-359) ──────────────────────────────────────────
  ['XL',          'xline'],
  ['XLINE',       'xline'],
  ['RAY',         'ray'],
  // ── Annotation symbols (ADR-583) ───────────────────────────────────────────
  ['NORTH',       'north-arrow'],
  ['NA',          'north-arrow'],
  ['SECTION',     'section-mark'],
  ['SEC',         'section-mark'],
  ['GRID',        'grid-bubble'],
  ['GB',          'grid-bubble'],
  ['ELEV',        'elevation-mark'],
  ['EL',          'elevation-mark'],
  ['CALLOUT',     'detail-callout'],
  ['DETAIL',      'detail-callout'],
  ['REVTAG',      'revision-tag'],
  ['REV',         'revision-tag'],
  // ── Graphic scale-bar (ADR-583 Φ2) — dedicated entity, generic 2-click tool ──
  ['SCALEBAR',    'scale-bar'],
  ['SB',          'scale-bar'],
] as const;

// Build lookup map (uppercase → toolId). Built-ins loaded once at module init.
const _builtIn = new Map<string, ToolType>(
  BUILT_IN.map(([alias, toolId]) => [alias.toUpperCase(), toolId]),
);

// User-custom overrides. Loaded lazily on first access.
let _custom: Map<string, ToolType> | null = null;

function _loadCustom(): Map<string, ToolType> {
  if (_custom !== null) return _custom;
  _custom = new Map();
  const parsed = storageGet<Record<string, string>>(LS_CUSTOM_KEY, {});
  for (const [alias, toolId] of Object.entries(parsed)) {
    _custom.set(alias.toUpperCase(), toolId as ToolType);
  }
  return _custom;
}

function _saveCustom(map: Map<string, ToolType>): void {
  const obj: Record<string, string> = {};
  map.forEach((toolId, alias) => { obj[alias] = toolId; });
  storageSet(LS_CUSTOM_KEY, obj);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve an alias to a ToolType. Custom aliases override built-ins.
 * Returns null if the alias is unknown.
 */
export function resolveAlias(alias: string): ToolType | null {
  const key = alias.trim().toUpperCase();
  const custom = _loadCustom();
  return custom.get(key) ?? _builtIn.get(key) ?? null;
}

/** Register a user-defined alias (persists to localStorage). */
export function registerCustomAlias(alias: string, toolId: ToolType): void {
  const key = alias.trim().toUpperCase();
  const custom = _loadCustom();
  custom.set(key, toolId);
  _saveCustom(custom);
}

/** Remove a user-defined alias. Cannot remove built-ins. */
export function removeCustomAlias(alias: string): void {
  const key = alias.trim().toUpperCase();
  const custom = _loadCustom();
  if (custom.has(key)) {
    custom.delete(key);
    _saveCustom(custom);
  }
}

/** Get all alias entries (built-ins + custom overrides), sorted. */
export function getAllAliases(): readonly AliasEntry[] {
  const custom = _loadCustom();
  const result: AliasEntry[] = [];

  _builtIn.forEach((toolId, alias) => {
    result.push({ alias, toolId, isBuiltIn: !custom.has(alias) });
  });
  custom.forEach((toolId, alias) => {
    if (!_builtIn.has(alias)) {
      result.push({ alias, toolId, isBuiltIn: false });
    }
  });
  result.sort((a, b) => compareByLocale(a.alias, b.alias));
  return result;
}

/**
 * Fuzzy-prefix match: return aliases whose key starts with the input prefix.
 * Case-insensitive. Used by CommandAutocompleteList.
 */
export function getMatchingAliases(prefix: string, limit = 10): readonly AliasEntry[] {
  if (!prefix) return [];
  const upper = prefix.trim().toUpperCase();
  const custom = _loadCustom();
  const seen = new Set<string>();
  const results: AliasEntry[] = [];

  // Custom first (overrides built-in)
  custom.forEach((toolId, alias) => {
    if (alias.startsWith(upper) && !seen.has(alias)) {
      seen.add(alias);
      results.push({ alias, toolId, isBuiltIn: false });
    }
  });

  _builtIn.forEach((toolId, alias) => {
    if (alias.startsWith(upper) && !seen.has(alias)) {
      seen.add(alias);
      results.push({ alias, toolId, isBuiltIn: true });
    }
  });

  results.sort((a, b) => compareByLocale(a.alias, b.alias));
  return results.slice(0, limit);
}

/** Invalidate the custom alias cache (call after external localStorage change). */
export function invalidateCustomAliasCache(): void {
  _custom = null;
}
