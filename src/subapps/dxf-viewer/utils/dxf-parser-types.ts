/**
 * DXF Parser Types & Constants
 *
 * Type definitions and constants for the DXF entity parser.
 * Extracted from dxf-entity-parser.ts for SRP compliance (ADR-065 Phase 4).
 *
 * @module dxf-viewer/utils/dxf-parser-types
 */

// ============================================================================
// SUPPORTED ENTITY TYPES
// ============================================================================

export const SUPPORTED_ENTITY_TYPES = [
  'LINE',
  'LWPOLYLINE',
  // Old-style POLYLINE (AutoCAD R12/AC1009 & any "Save As R12"): POLYLINE + VERTEX… + SEQEND.
  // Parsed specially via DxfEntityParser.parsePolylineGroup (compound entity, not flat parseEntity).
  'POLYLINE',
  'CIRCLE',
  'ARC',
  'TEXT',
  'INSERT',
  'SPLINE',
  'ELLIPSE',
  'MTEXT',
  'MULTILINETEXT',
  'DIMENSION',
  'HATCH',
  'SOLID',
  // ADR-635 Φάση B — filled-quad primitives (3DFACE/TRACE → hatch), POINT, MLINE (reference line).
  '3DFACE',
  'TRACE',
  'POINT',
  'MLINE',
  // ADR-635 Φάση B Batch 2 — block attribute value (ATTRIB, visible) + definition
  // template (ATTDEF, skipped per-INSERT via block-expander guard). Both → type:'text'.
  'ATTRIB',
  'ATTDEF',
  // ADR-635 Φάση B Batch 2 Part B — annotation callout (path + tip arrowhead → LeaderEntity).
  'LEADER',
  'XLINE',
  'RAY'
] as const;

export const DXF_SECTION_MARKERS = [
  'SECTION',
  'ENDSEC',
  'EOF',
  'TABLE',
  'ENDTAB',
  'HEADER',
  'ENDHDR',
  'CLASSES',
  'OBJECTS',
  'BLOCKS',
  'ENDBLK',
  'BLOCK'
] as const;

// ============================================================================
// DXF HEADER DATA TYPE
// ============================================================================

/**
 * Parsed values from HEADER section that affect entity interpretation.
 * Critical for correct text/dimension scaling.
 */
export interface DxfHeaderData {
  /** $INSUNITS - Drawing units (0=Unitless, 1=Inches, 2=Feet, 4=mm, 5=cm, 6=m) */
  insunits: number;
  /** $DIMSCALE - Overall dimension scale factor */
  dimscale: number;
  /** $DIMTXT - Default dimension text height */
  dimtxt: number;
  /** $CANNOSCALEVALUE - Current annotation scale value */
  annoScale: number;
  /** $MEASUREMENT - Drawing units (0=English, 1=Metric) */
  measurement: number;
  /**
   * $PDMODE - Point display mode bitmask (ADR-635 Φάση C). Drawing-wide: figure =
   * `pdmode & 7` (0=dot,1=none,2=plus,3=X,4=tick), +32=circle around, +64=square around.
   * Baked onto every imported PointEntity so PointRenderer draws the AutoCAD glyph.
   */
  pdmode: number;
  /**
   * $PDSIZE - Point display size (ADR-635 Φάση C). >0 = absolute drawing units,
   * 0 = 5% of viewport height, <0 = |value|% of viewport height.
   */
  pdsize: number;
}

// ============================================================================
// DIMSTYLE DATA TYPE
// ============================================================================

/**
 * Parsed values from DIMSTYLE table entries in TABLES section.
 *
 * Extends the legacy 4-field version (Phase A pre-ADR-362) with all rendering-
 * relevant fields so that `parseDimStyles()` can participate in full roundtrip
 * tests (ADR-362 Phase H1). Non-rendering fields (handles, xdata, Nestor internals)
 * are intentionally omitted — the parser does not emit them.
 */
export interface DimStyleEntry {
  // ── Identity ───────────────────────────────────────────────────────────────
  /** Style name (code 2) */
  name: string;

  // ── Scale / geometry ───────────────────────────────────────────────────────
  /** DIMSCALE — overall scale factor (code 40) */
  dimscale: number;
  /** DIMASZ — arrow size (code 41) */
  dimasz: number;
  /** DIMEXO — extension offset from object (code 42) */
  dimexo: number;
  /** DIMDLI — baseline/continued chain spacing (code 43) */
  dimdli: number;
  /** DIMEXE — extension beyond dim line (code 44) */
  dimexe: number;
  /** DIMRND — rounding factor (code 45) */
  dimrnd: number;
  /** DIMTP — tolerance plus (code 47) */
  dimtp: number;
  /** DIMTM — tolerance minus, stored negative (code 48, parsed positive then negated) */
  dimtm: number;

  // ── Text ───────────────────────────────────────────────────────────────────
  /** DIMTXT — text height (code 140) */
  dimtxt: number;
  /** DIMCEN — center mark size (code 141) */
  dimcen: number;
  /** DIMALTF — alternate unit scale (code 143) */
  dimaltf: number;
  /** DIMLFAC — linear measurement scale (code 144) */
  dimlfac: number;
  /** DIMTFAC — tolerance text height factor (code 146) */
  dimtfac: number;
  /** DIMGAP — text gap (code 147) */
  dimgap: number;
  /** DIMALTRND — alternate rounding (code 148) */
  dimaltrnd: number;

  // ── Flags ──────────────────────────────────────────────────────────────────
  /** DIMTOL — show tolerance flag (code 71) */
  dimtol: boolean;
  /** DIMLIM — show limits flag (code 72) */
  dimlim: boolean;
  /** DIMTIH — text inside horizontal (code 73) */
  dimtih: boolean;
  /** DIMTOH — text outside horizontal (code 74) */
  dimtoh: boolean;
  /** DIMSE1 — suppress ext line 1 (code 75) */
  suppressExtLine1: boolean;
  /** DIMSE2 — suppress ext line 2 (code 76) */
  suppressExtLine2: boolean;
  /** DIMTAD — text vertical placement (code 77, integer 0-4) */
  dimtad: number;
  /** DIMZIN — zero suppression bitmask (code 78) */
  dimzin: number;

  // ── Alternate / color ──────────────────────────────────────────────────────
  /** DIMALT — alternate units on (code 170) */
  dimalt: boolean;
  /** DIMALTD — alternate precision (code 171) */
  dimaltd: number;
  /** DIMTOFL — force dim line inside (code 172) */
  dimtofl: boolean;
  /** DIMTIX — force text inside (code 174) */
  dimtix: boolean;
  /** DIMCLRD — dim line color (code 176) */
  dimclrd: number;
  /** DIMCLRE — ext line color (code 177) */
  dimclre: number;
  /** DIMCLRT — text color (code 178) */
  dimclrt: number;
  /** DIMADEC — angular decimal precision (code 179) */
  dimadec: number;

  // ── Units ──────────────────────────────────────────────────────────────────
  /** DIMLUNIT — linear unit format (code 270, 1-6) */
  dimlunit: number;
  /** DIMDEC — linear decimal precision (code 271) */
  dimdec: number;
  /** DIMTDEC — tolerance decimal precision (code 272) */
  dimtdec: number;
  /** DIMALTU — alternate unit format (code 273, 1-6) */
  dimaltu: number;
  /** DIMAUNIT — angular unit format (code 275, 0-4) */
  dimaunit: number;
  /** DIMDSEP — decimal separator ASCII code (code 278; 46='.', 44=',') */
  dimdsep: number;
  /** DIMTMOVE — text move rule (code 279, 0-2) */
  dimtmove: number;
  /** DIMSD1 — suppress dim line 1 (code 281) */
  suppressDimLine1: boolean;
  /** DIMSD2 — suppress dim line 2 (code 282) */
  suppressDimLine2: boolean;
  /** DIMTOLJ — tolerance justify (code 283, 0=bottom/1=middle/2=top) */
  dimtolj: number;
  /** DIMATFIT — arrowhead/text fit (code 289, 0-3) */
  dimatfit: number;
}

/** Map of DIMSTYLE names to their properties */
export type DimStyleMap = Record<string, DimStyleEntry>;

/** Default DIMSTYLE as fallback (AutoCAD "Standard" defaults) */
export const DEFAULT_DIMSTYLE: DimStyleEntry = {
  name: 'Standard',
  dimscale: 1.0,
  dimasz: 2.5,
  dimexo: 0.625,
  dimdli: 3.75,
  dimexe: 1.25,
  dimrnd: 0,
  dimtp: 0,
  dimtm: 0,
  dimtxt: 2.5,
  dimcen: 2.5,
  dimaltf: 25.4,
  dimlfac: 1.0,
  dimtfac: 1.0,
  dimgap: 0.625,
  dimaltrnd: 0,
  dimtol: false,
  dimlim: false,
  dimtih: true,
  dimtoh: true,
  suppressExtLine1: false,
  suppressExtLine2: false,
  dimtad: 0,
  dimzin: 0,
  dimalt: false,
  dimaltd: 2,
  dimtofl: false,
  dimtix: false,
  dimclrd: 0,
  dimclre: 0,
  dimclrt: 0,
  dimadec: 0,
  dimlunit: 2,
  dimdec: 4,
  dimtdec: 4,
  dimaltu: 2,
  dimaunit: 0,
  dimdsep: 46,
  dimtmove: 0,
  suppressDimLine1: false,
  suppressDimLine2: false,
  dimtolj: 1,
  dimatfit: 3,
};

// ============================================================================
// LAYER COLOR DATA TYPE
// ============================================================================

/**
 * Parsed from LAYER table in TABLES section.
 * Contains the REAL ACI color for each layer (code 62).
 */
export interface LayerColorEntry {
  /** Layer name (code 2) */
  name: string;
  /** ACI color index (code 62) - 1-255 */
  colorIndex: number;
  /** Resolved hex color from ACI palette */
  color: string;
  /** Layer visibility (code 62 negative = frozen) */
  visible: boolean;
}

/** Map of layer names to their color properties */
export type LayerColorMap = Record<string, LayerColorEntry>;

// ============================================================================
// INSUNITS CONVERSION TABLE
// ============================================================================

/**
 * Converts DXF units to mm (internal base unit)
 */
export const INSUNITS_TO_MM: Record<number, number> = {
  0: 1,       // Unitless - assume mm
  1: 25.4,    // Inches → mm
  2: 304.8,   // Feet → mm
  3: 1609344, // Miles → mm
  4: 1,       // Millimeters → mm (base)
  5: 10,      // Centimeters → mm
  6: 1000,    // Meters → mm
  7: 1000000, // Kilometers → mm
  8: 0.0000254, // Microinches → mm
  9: 0.0254,  // Mils → mm
  10: 914.4,  // Yards → mm
  11: 1e-7,   // Angstroms → mm
  12: 1e-6,   // Nanometers → mm
  13: 0.001,  // Microns → mm
  14: 100,    // Decimeters → mm
  15: 10000,  // Decameters → mm
  16: 100000, // Hectometers → mm
  17: 1852000, // Gigameters → mm (nautical mile)
  18: 1.496e14, // Astronomical units → mm
  19: 9.461e18, // Light years → mm
  20: 3.086e19, // Parsecs → mm
};

/** Unit name lookup for logging */
export const INSUNITS_NAMES: Record<number, string> = {
  0: 'Unitless', 1: 'Inches', 2: 'Feet', 4: 'Millimeters',
  5: 'Centimeters', 6: 'Meters', 7: 'Kilometers'
};
