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
}

export type LinetypeOrigin =
  | 'iso-baseline'
  | 'lin-import'
  | 'user-created'
  | 'dxf-import';

/** Ordered list of ISO baseline linetype names. */
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
  });

/** True if `name` is one of the 8 ISO baseline linetypes (case-sensitive). */
export function isIsoBaselineLinetype(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(LINETYPE_ISO_CATALOG, name);
}

/** Resolve an ISO baseline linetype by name. Returns null for unknown names. */
export function getIsoLinetype(name: string): LinetypeDef | null {
  return isIsoBaselineLinetype(name) ? LINETYPE_ISO_CATALOG[name] : null;
}

/** Snapshot list of all ISO baseline definitions, in canonical order. */
export function listIsoLinetypes(): ReadonlyArray<LinetypeDef> {
  return LINETYPE_ISO_NAMES.map((n) => LINETYPE_ISO_CATALOG[n]);
}
