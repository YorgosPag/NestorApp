/**
 * DEFAULT VALUES για DXF Settings
 * Βασισμένα σε ISO standards και AutoCAD conventions
 */

import type { LineSettings, TextSettings, GripSettings, DxfSettings } from './types';

// ============================================================================
// LINE DEFAULTS - ISO 128 Standards
// ============================================================================

export const DEFAULT_LINE_SETTINGS: LineSettings = {
  enabled: true,
  lineType: 'solid',           // ISO 128: Continuous line as default
  lineWidth: 0.25,             // ISO 128: Standard 0.25mm line weight
  color: '#FFFFFF',            // AutoCAD ACI 7: White for main lines
  opacity: 1.0,                // Full opacity standard
  dashScale: 1.0,              // Standard dash scale
  dashOffset: 0,               // No offset standard
  lineCap: 'butt',             // Standard cap style
  lineJoin: 'miter',           // Standard join style
  breakAtCenter: false,        // No break at center default

  // Hover state
  hoverColor: '#FFFF00',       // AutoCAD ACI 2: Yellow for hover
  hoverType: 'solid',          // Solid hover type
  hoverWidth: 0.35,            // ISO 128: Next standard width
  hoverOpacity: 0.8,           // Reduced opacity for hover

  // Final state
  finalColor: '#00FF00',       // AutoCAD ACI 3: Green for final state
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
  color: '#FFFFFF',            // AutoCAD ACI 7: White
  opacity: 1.0,                // Full opacity
  letterSpacing: 0,            // Normal spacing
  lineHeight: 1.2,             // Standard line height
  textAlign: 'left',           // Standard alignment
  textBaseline: 'alphabetic',  // Standard baseline

  // Shadow
  shadowEnabled: false,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowBlur: 0,
  shadowColor: '#000000',

  // Outline
  strokeEnabled: false,
  strokeWidth: 1,
  strokeColor: '#000000',

  // Background
  backgroundEnabled: false,
  backgroundColor: '#000000',
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
    cold: '#0000FF',           // AutoCAD: Blue (ACI 5) - unselected grips
    warm: '#FF69B4',           // AutoCAD: Hot Pink - hover grips
    hot: '#FF0000',            // AutoCAD: Red (ACI 1) - selected grips
    contour: '#000000'         // AutoCAD: Black contour
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
// COMBINED DEFAULTS
// ============================================================================

export const DEFAULT_DXF_SETTINGS: DxfSettings = {
  line: DEFAULT_LINE_SETTINGS,
  text: DEFAULT_TEXT_SETTINGS,
  grip: DEFAULT_GRIP_SETTINGS
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
    color: '#808080',
    opacity: 0.6
  },
  dimension: {
    name: 'Dimension',
    lineType: 'solid' as const,
    lineWidth: 0.18,
    color: '#FF00FF',
    opacity: 1.0
  },
  hidden: {
    name: 'Hidden',
    lineType: 'dashed' as const,
    lineWidth: 0.25,
    color: '#00FF00',
    opacity: 0.7
  },
  center: {
    name: 'Center',
    lineType: 'dash-dot' as const,
    lineWidth: 0.18,
    color: '#FFFF00',
    opacity: 1.0
  },
  outline: {
    name: 'Outline',
    lineType: 'solid' as const,
    lineWidth: 0.5,
    color: '#FFFFFF',
    opacity: 1.0
  }
};

export const TEXT_TEMPLATES = {
  title: {
    name: 'Title',
    fontSize: 7.0,
    fontWeight: 700,
    color: '#FFFFFF'
  },
  subtitle: {
    name: 'Subtitle',
    fontSize: 5.0,
    fontWeight: 600,
    color: '#E0E0E0'
  },
  normal: {
    name: 'Normal',
    fontSize: 3.5,
    fontWeight: 400,
    color: '#FFFFFF'
  },
  annotation: {
    name: 'Annotation',
    fontSize: 2.5,
    fontWeight: 400,
    fontStyle: 'italic' as const,
    color: '#FFFF00'
  },
  dimension: {
    name: 'Dimension',
    fontSize: 2.5,
    fontWeight: 400,
    color: '#FF00FF'
  }
};