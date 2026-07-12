/**
 * Linetype ISO Catalog — ADR-358 §5.3 + §5.3.bis (Q4 FULL).
 *
 * Immutable SSoT for the 8 ISO baseline linetypes shipped with the DXF viewer.
 * Custom linetypes (.lin import, user-created, DXF-import preserved) live in
 * `stores/LinetypeRegistry.ts` and reference this catalog as their baseline.
 *
 * Pattern format (DXF-native, see AutoCAD `LTYPE` table):
 *   array of numbers in drawing units (mm internal, ADR-357 §5.5).
 *   - positive value = dash length
 *   - negative value = gap length
 *   - 0               = dot (zero-length dash)
 *   empty array       = solid (Continuous)
 *
 * Pre-commit ratchet `linetype-iso-catalog` BLOCKS hardcoded ISO name literals
 * outside this file + registry + tests + DXF I/O bridge.
 */

// ADR-642 §6.2 — superset: ένας τύπος γραμμής μπορεί να κουβαλά και πλήρη complex
// ορισμό (text/symbols/caps/width/compound). Type-only import → κανένας runtime
// κύκλος (τα complex types δεν κάνουν runtime import από εδώ).
import type { ComplexLinetypeDef } from './complex-linetype-types';

/** A linetype definition — ISO baseline or runtime-registered. */
export interface LinetypeDef {
  /** Stable id for runtime-registered linetypes (`ltp_<ULID>`). ISO baseline omits. */
  readonly id?: string;
  /** DXF identifier (case-sensitive — AutoCAD convention). */
  readonly name: string;
  /** Human-readable pattern preview. */
  readonly description: string;
  /** DXF-native pattern: positive = dash, negative = gap, 0 = dot. */
  readonly pattern: ReadonlyArray<number>;
  /** Provenance — internal, not DXF. */
  readonly origin: LinetypeOrigin;
  /** Source `.lin` filename when `origin === 'lin-import'`. */
  readonly sourceFile?: string;
  /**
   * ADR-642 §6.2 — προαιρετικός πλήρης complex ορισμός (superset). Παρών ΜΟΝΟ για
   * τύπους που δεν εκφράζονται ως simple `pattern` (embedded text/symbols/compound/
   * caps/variable-width). Simple τύποι το αφήνουν `undefined` και κρατούν το `pattern`
   * ως SSoT (zero migration). Ο renderer/DXF-writer προτιμά το `complex` όταν υπάρχει.
   */
  readonly complex?: ComplexLinetypeDef;
}

export type LinetypeOrigin =
  | 'iso-baseline'
  | 'bim-special'
  | 'lin-import'
  | 'user-created'
  | 'dxf-import';

/**
 * Ordered list of the 8 ISO 128 baseline linetype names (the canonical roots).
 * `*2` / `*X2` density variants + Dot/Double/Zigzag live in the full catalog
 * (`LINETYPE_CATALOG_NAMES`) but are NOT "ISO baseline" in the strict sense.
 */
export const LINETYPE_ISO_NAMES = Object.freeze([
  'Continuous',
  'Dashed',
  'Hidden',
  'Center',
  'Phantom',
  'DashDot',
  'Border',
  'Divide',
]) as ReadonlyArray<string>;

/** Default linetype applied when none specified — AutoCAD convention. */
export const DEFAULT_LINETYPE_NAME = 'Continuous';

/**
 * ISO 8 baseline catalog — immutable. Pattern values in mm.
 * Values cross-referenced with AutoCAD `acadiso.lin` standard distribution.
 */
export const LINETYPE_ISO_CATALOG: Readonly<Record<string, LinetypeDef>> =
  Object.freeze({
    Continuous: Object.freeze({
      name: 'Continuous',
      description: 'Solid line',
      pattern: Object.freeze([]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),
    Dashed: Object.freeze({
      name: 'Dashed',
      description: '_ _ _ _',
      pattern: Object.freeze([12.7, -6.35]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),
    Hidden: Object.freeze({
      name: 'Hidden',
      description: '_ _ _ _ (short)',
      pattern: Object.freeze([6.35, -3.175]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),
    Center: Object.freeze({
      name: 'Center',
      description: '____ _ ____ _ ____',
      pattern: Object.freeze([31.75, -6.35, 6.35, -6.35]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),
    Phantom: Object.freeze({
      name: 'Phantom',
      description: '____ _ _ ____ _ _',
      pattern: Object.freeze([
        31.75, -6.35, 6.35, -6.35, 6.35, -6.35,
      ]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),
    DashDot: Object.freeze({
      name: 'DashDot',
      description: '_._._._',
      pattern: Object.freeze([12.7, -6.35, 0, -6.35]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),
    Border: Object.freeze({
      name: 'Border',
      description: '__ __ . __ __ .',
      pattern: Object.freeze([
        12.7, -3.175, 12.7, -3.175, 0, -3.175,
      ]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),
    Divide: Object.freeze({
      name: 'Divide',
      description: '__ . . __ . .',
      pattern: Object.freeze([
        12.7, -3.175, 0, -3.175, 0, -3.175,
      ]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),

    // ── Density variants (acadiso.lin: `2` = half scale, `X2` = double scale) ──
    Dashed2: Object.freeze({
      name: 'Dashed2', description: '_ _ _ (½)',
      pattern: Object.freeze([6.35, -3.175]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),
    DashedX2: Object.freeze({
      name: 'DashedX2', description: '__  __  __ (×2)',
      pattern: Object.freeze([25.4, -12.7]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),
    Hidden2: Object.freeze({
      name: 'Hidden2', description: '_ _ _ _ (½)',
      pattern: Object.freeze([3.175, -1.5875]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),
    HiddenX2: Object.freeze({
      name: 'HiddenX2', description: '__ __ __ (×2)',
      pattern: Object.freeze([12.7, -6.35]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),
    Center2: Object.freeze({
      name: 'Center2', description: '____ _ ____ (½)',
      pattern: Object.freeze([15.875, -3.175, 3.175, -3.175]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),
    CenterX2: Object.freeze({
      name: 'CenterX2', description: '________ __ (×2)',
      pattern: Object.freeze([63.5, -12.7, 12.7, -12.7]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),
    Phantom2: Object.freeze({
      name: 'Phantom2', description: '____ _ _ (½)',
      pattern: Object.freeze([15.875, -3.175, 3.175, -3.175, 3.175, -3.175]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),
    PhantomX2: Object.freeze({
      name: 'PhantomX2', description: '________ __ __ (×2)',
      pattern: Object.freeze([63.5, -12.7, 12.7, -12.7, 12.7, -12.7]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),
    DashDot2: Object.freeze({
      name: 'DashDot2', description: '_._._ (½)',
      pattern: Object.freeze([6.35, -3.175, 0, -3.175]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),
    DashDotX2: Object.freeze({
      name: 'DashDotX2', description: '__ . __ . (×2)',
      pattern: Object.freeze([25.4, -12.7, 0, -12.7]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),
    Border2: Object.freeze({
      name: 'Border2', description: '__ __ . (½)',
      pattern: Object.freeze([6.35, -1.5875, 6.35, -1.5875, 0, -1.5875]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),
    BorderX2: Object.freeze({
      name: 'BorderX2', description: '__ __ . (×2)',
      pattern: Object.freeze([25.4, -6.35, 25.4, -6.35, 0, -6.35]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),
    Divide2: Object.freeze({
      name: 'Divide2', description: '__ . . (½)',
      pattern: Object.freeze([6.35, -1.5875, 0, -1.5875, 0, -1.5875]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),
    DivideX2: Object.freeze({
      name: 'DivideX2', description: '__ . . (×2)',
      pattern: Object.freeze([25.4, -6.35, 0, -6.35, 0, -6.35]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),

    // ── Dot family (acadiso.lin DOT: zero-length dash + gap) ──
    Dot: Object.freeze({
      name: 'Dot', description: '. . . . .',
      pattern: Object.freeze([0, -6.35]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),
    Dot2: Object.freeze({
      name: 'Dot2', description: '. . . (½)',
      pattern: Object.freeze([0, -3.175]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),
    DotX2: Object.freeze({
      name: 'DotX2', description: '.  .  . (×2)',
      pattern: Object.freeze([0, -12.7]) as ReadonlyArray<number>,
      origin: 'iso-baseline' as const,
    }),

    // ── BIM specials (ADR-377 — non-ISO; metric approximation of px patterns) ──
    Double: Object.freeze({
      name: 'Double', description: 'alternating double-dash',
      pattern: Object.freeze([12.7, -3.175, 6.35, -3.175]) as ReadonlyArray<number>,
      origin: 'bim-special' as const,
    }),
    Zigzag: Object.freeze({
      name: 'Zigzag', description: 'insulation/batting (dash approximation)',
      pattern: Object.freeze([6.35, -3.175, 3.175, -3.175]) as ReadonlyArray<number>,
      origin: 'bim-special' as const,
    }),
  });

/**
 * Full ordered catalog name list — 8 ISO base + 14 density variants + 3 Dot +
 * 2 BIM specials. Used to seed the runtime registry and populate UI dropdowns.
 * `LINETYPE_ISO_NAMES` remains the strict 8-entry ISO baseline subset.
 */
export const LINETYPE_CATALOG_NAMES = Object.freeze([
  'Continuous',
  'Dashed', 'Dashed2', 'DashedX2',
  'Hidden', 'Hidden2', 'HiddenX2',
  'Center', 'Center2', 'CenterX2',
  'Phantom', 'Phantom2', 'PhantomX2',
  'DashDot', 'DashDot2', 'DashDotX2',
  'Border', 'Border2', 'BorderX2',
  'Divide', 'Divide2', 'DivideX2',
  'Dot', 'Dot2', 'DotX2',
  'Double', 'Zigzag',
]) as ReadonlyArray<string>;

/**
 * True if `name` is a **standard acadiso** linetype (`origin: 'iso-baseline'` —
 * the 8 base + density variants + Dot family). These are implicit in DXF readers,
 * so the writer does NOT emit a custom `LTYPE` table entry for them. BIM-specials
 * (Double/Zigzag) and custom/imported linetypes return false ⇒ they DO get written.
 */
export function isIsoBaselineLinetype(name: string): boolean {
  const def = LINETYPE_ISO_CATALOG[name];
  return def !== undefined && def.origin === 'iso-baseline';
}

/** True if `name` exists anywhere in the built-in catalog (incl. variants/specials). */
export function isCatalogLinetype(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(LINETYPE_ISO_CATALOG, name);
}

/** Resolve any built-in catalog linetype by name (incl. variants/specials). Null on miss. */
export function getCatalogLinetype(name: string): LinetypeDef | null {
  return LINETYPE_ISO_CATALOG[name] ?? null;
}

/** @deprecated Use {@link getCatalogLinetype}. Kept for back-compat — same general lookup. */
export function getIsoLinetype(name: string): LinetypeDef | null {
  return getCatalogLinetype(name);
}

/** Snapshot list of the strict 8 ISO baseline definitions, in canonical order. */
export function listIsoLinetypes(): ReadonlyArray<LinetypeDef> {
  return LINETYPE_ISO_NAMES.map((n) => LINETYPE_ISO_CATALOG[n]);
}

/** Snapshot list of ALL built-in catalog definitions, in canonical order. */
export function listAllLinetypes(): ReadonlyArray<LinetypeDef> {
  return LINETYPE_CATALOG_NAMES.map((n) => LINETYPE_ISO_CATALOG[n]);
}
