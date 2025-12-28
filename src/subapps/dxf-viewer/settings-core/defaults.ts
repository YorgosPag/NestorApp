/**
 * DEFAULT VALUES για DXF Settings
 * Βασισμένα σε ISO standards και AutoCAD conventions
 */

import type {
  LineSettings,
  TextSettings,
  GripSettings,
  EnterpriseCursorSettings,
  EnterpriseGridSettings,
  EnterpriseRulerSettings,
  DxfSettings
} from './types';
import { UI_COLORS } from '../config/color-config';

// ============================================================================
// LINE DEFAULTS - ISO 128 Standards
// ============================================================================

export const DEFAULT_LINE_SETTINGS: LineSettings = {
  enabled: true,
  lineType: 'solid',           // ISO 128: Continuous line as default
  lineWidth: 0.25,             // ISO 128: Standard 0.25mm line weight
  color: UI_COLORS.WHITE,      // AutoCAD ACI 7: White for main lines
  opacity: 1.0,                // Full opacity standard
  dashScale: 1.0,              // Standard dash scale
  dashOffset: 0,               // No offset standard
  lineCap: 'butt',             // Standard cap style
  lineJoin: 'miter',           // Standard join style
  breakAtCenter: false,        // No break at center default

  // Hover state
  hoverColor: UI_COLORS.SNAP_DEFAULT,       // AutoCAD ACI 2: Yellow for hover
  hoverType: 'solid',          // Solid hover type
  hoverWidth: 0.35,            // ISO 128: Next standard width
  hoverOpacity: 0.8,           // Reduced opacity for hover

  // Final state
  finalColor: UI_COLORS.BRIGHT_GREEN,       // AutoCAD ACI 3: Green for final state
  finalType: 'solid',          // Solid final type
  finalWidth: 0.35,            // ISO 128: Slightly thicker for final
  finalOpacity: 1.0,           // Full opacity for final

  activeTemplate: null
};

// ============================================================================
// TEXT DEFAULTS - ISO 3098 Standards
// ============================================================================

export const DEFAULT_TEXT_SETTINGS: TextSettings = {
  enabled: true,
  fontFamily: 'Arial',         // Standard font
  fontSize: 3.5,               // ISO 3098: 3.5mm standard height
  fontWeight: 400,             // Normal weight
  fontStyle: 'normal',         // Normal style
  color: UI_COLORS.WHITE,      // AutoCAD ACI 7: White
  opacity: 1.0,                // Full opacity
  letterSpacing: 0,            // Normal spacing
  lineHeight: 1.2,             // Standard line height
  textAlign: 'left',           // Standard alignment
  textBaseline: 'alphabetic',  // Standard baseline

  // Boolean text styling (backward compatibility)
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isStrikethrough: false,
  isSuperscript: false,
  isSubscript: false,

  // Shadow
  shadowEnabled: false,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowBlur: 0,
  shadowColor: UI_COLORS.BLACK,

  // Outline
  strokeEnabled: false,
  strokeWidth: 1,
  strokeColor: UI_COLORS.BLACK,

  // Background
  backgroundEnabled: false,
  backgroundColor: UI_COLORS.BLACK,
  backgroundPadding: 4,

  activeTemplate: null
};

// ============================================================================
// GRIP DEFAULTS - AutoCAD Standards
// ============================================================================

export const DEFAULT_GRIP_SETTINGS: GripSettings = {
  enabled: true,
  gripSize: 5,                 // AutoCAD GRIPSIZE default: 5 DIP
  pickBoxSize: 3,              // AutoCAD PICKBOX default: 3 DIP
  apertureSize: 10,            // AutoCAD APERTURE default: 10 pixels
  opacity: 1.0,                // Full opacity
  colors: {
    cold: UI_COLORS.SNAP_CENTER,           // AutoCAD: Blue (ACI 5) - unselected grips
    warm: UI_COLORS.SNAP_INTERSECTION,     // AutoCAD: Hot Pink - hover grips
    hot: UI_COLORS.SNAP_ENDPOINT,          // AutoCAD: Red (ACI 1) - selected grips
    contour: UI_COLORS.BLACK               // AutoCAD: Black contour
  },
  showAperture: true,          // Show aperture box
  multiGripEdit: true,         // Allow multiple grip editing
  snapToGrips: true,           // Snap to grips enabled
  showMidpoints: true,         // Show midpoint grips
  showCenters: true,           // Show center grips
  showQuadrants: true,         // Show quadrant grips
  maxGripsPerEntity: 50        // Maximum grips per entity
};

// ============================================================================
// CURSOR DEFAULTS - AutoCAD Standards
// ============================================================================

export const DEFAULT_CURSOR_SETTINGS: EnterpriseCursorSettings = {
  enabled: true,
  crosshairSize: 25,          // 25% of viewport
  crosshairColor: UI_COLORS.WHITE,  // White crosshair
  cursorSize: 5,               // 5px cursor box
  cursorColor: UI_COLORS.BRIGHT_GREEN       // Green cursor
};

// ============================================================================
// GRID DEFAULTS - CAD Standards
// ============================================================================

export const DEFAULT_GRID_SETTINGS: EnterpriseGridSettings = {
  enabled: true,
  spacing: 10,                 // 10mm default spacing
  majorLineInterval: 5,        // Major line every 5 lines
  color: UI_COLORS.GRID_MAJOR,        // Dark gray for minor lines
  majorColor: UI_COLORS.GRID_MINOR,   // Medium gray for major lines
  opacity: 0.5,                // 50% opacity
  style: 'lines'               // Default to lines
};

// ============================================================================
// RULER DEFAULTS - CAD Standards
// ============================================================================

export const DEFAULT_RULER_SETTINGS: EnterpriseRulerSettings = {
  enabled: true,
  unit: 'mm',                  // Metric default
  fontSize: 10,                // 10px font
  textColor: UI_COLORS.WHITE,         // White text
  backgroundColor: UI_COLORS.DARK_BACKGROUND // Dark background
};

// ============================================================================
// COMBINED DEFAULTS
// ============================================================================

export const DEFAULT_DXF_SETTINGS: DxfSettings = {
  line: DEFAULT_LINE_SETTINGS,
  text: DEFAULT_TEXT_SETTINGS,
  grip: DEFAULT_GRIP_SETTINGS,
  cursor: DEFAULT_CURSOR_SETTINGS,
  grid: DEFAULT_GRID_SETTINGS,
  ruler: DEFAULT_RULER_SETTINGS
};

// ============================================================================
// DASH PATTERNS - AutoCAD Standards
// ============================================================================

export const DASH_PATTERNS: Record<string, number[]> = {
  solid: [],
  dotted: [1, 3],
  dashed: [5, 5],
  'dash-dot': [5, 3, 1, 3],
  'dash-dot-dot': [5, 3, 1, 3, 1, 3],
};

/**
 * Υπολογίζει το dash array για ένα line type με scale
 */
export function getDashArray(lineType: string, dashScale: number = 1): number[] {
  const basePattern = DASH_PATTERNS[lineType] || [];
  if (basePattern.length === 0) return [];
  return basePattern.map(value => value * dashScale);
}

// ============================================================================
// TEMPLATE DEFAULTS - Προκαθορισμένα templates
// ============================================================================

export const LINE_TEMPLATES = {
  construction: {
    name: 'Construction',
    lineType: 'dashed' as const,
    lineWidth: 0.13,
    color: UI_COLORS.MEDIUM_GRAY,
    opacity: 0.6
  },
  dimension: {
    name: 'Dimension',
    lineType: 'solid' as const,
    lineWidth: 0.18,
    color: UI_COLORS.SNAP_INTERSECTION,
    opacity: 1.0
  },
  hidden: {
    name: 'Hidden',
    lineType: 'dashed' as const,
    lineWidth: 0.25,
    color: UI_COLORS.BRIGHT_GREEN,
    opacity: 0.7
  },
  center: {
    name: 'Center',
    lineType: 'dash-dot' as const,
    lineWidth: 0.18,
    color: UI_COLORS.BRIGHT_YELLOW,
    opacity: 1.0
  },
  outline: {
    name: 'Outline',
    lineType: 'solid' as const,
    lineWidth: 0.5,
    color: UI_COLORS.WHITE,
    opacity: 1.0
  }
};

export const TEXT_TEMPLATES = {
  title: {
    name: 'Title',
    fontSize: 7.0,
    fontWeight: 700,
    color: UI_COLORS.WHITE
  },
  subtitle: {
    name: 'Subtitle',
    fontSize: 5.0,
    fontWeight: 600,
    color: UI_COLORS.LIGHT_GRAY
  },
  normal: {
    name: 'Normal',
    fontSize: 3.5,
    fontWeight: 400,
    color: UI_COLORS.WHITE
  },
  annotation: {
    name: 'Annotation',
    fontSize: 2.5,
    fontWeight: 400,
    fontStyle: 'italic' as const,
    color: UI_COLORS.BRIGHT_YELLOW
  },
  dimension: {
    name: 'Dimension',
    fontSize: 2.5,
    fontWeight: 400,
    color: UI_COLORS.SNAP_INTERSECTION
  }
};