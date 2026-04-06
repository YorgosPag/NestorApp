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
  'SOLID'
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
}

// ============================================================================
// DIMSTYLE DATA TYPE
// ============================================================================

/**
 * Parsed values from DIMSTYLE table entries in TABLES section.
 * Contains the actual text height for dimensions (DIMTXT - code 140).
 */
export interface DimStyleEntry {
  /** Style name (code 2) - e.g., "Standard", "ISO-25", "Annotative" */
  name: string;
  /** DIMTXT - Text height for dimensions (code 140) */
  dimtxt: number;
  /** DIMSCALE - Dimension scale factor for this style (code 40) */
  dimscale: number;
  /** DIMTFAC - Tolerance text height factor (code 146) */
  dimtfac: number;
  /** DIMASZ - Arrow size (code 41) - useful for proportional sizing */
  dimasz: number;
}

/** Map of DIMSTYLE names to their properties */
export type DimStyleMap = Record<string, DimStyleEntry>;

/** Default DIMSTYLE as fallback (AutoCAD "Standard" defaults) */
export const DEFAULT_DIMSTYLE: DimStyleEntry = {
  name: 'Standard',
  dimtxt: 2.5,
  dimscale: 1.0,
  dimtfac: 1.0,
  dimasz: 2.5
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
