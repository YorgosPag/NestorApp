/**
 * DOMAIN TYPES για DXF Settings
 * Strict typed interfaces με ISO standards και validation
 */

// ============================================================================
// LINE SETTINGS
// ============================================================================

export type LineType = 'solid' | 'dashed' | 'dotted' | 'dash-dot' | 'dash-dot-dot';
export type LineCapStyle = 'butt' | 'round' | 'square';
export type LineJoinStyle = 'miter' | 'round' | 'bevel';

export interface LineSettings {
  enabled: boolean;
  lineType: LineType;
  lineWidth: number;        // 0.25 - 2.0mm (ISO 128)
  color: string;            // Hex color
  opacity: number;          // 0.0 - 1.0
  dashScale: number;        // 0.5 - 3.0
  dashOffset: number;       // 0 - 100
  lineCap: LineCapStyle;
  lineJoin: LineJoinStyle;
  breakAtCenter: boolean;

  // Hover state
  hoverColor: string;
  hoverType: LineType;
  hoverWidth: number;
  hoverOpacity: number;

  // Final state
  finalColor: string;
  finalType: LineType;
  finalWidth: number;
  finalOpacity: number;

  activeTemplate: string | null;
}

// ============================================================================
// TEXT SETTINGS
// ============================================================================

export type TextAlign = 'left' | 'center' | 'right' | 'justify';
export type TextBaseline = 'top' | 'middle' | 'bottom' | 'alphabetic';

export interface TextSettings {
  enabled: boolean;
  fontFamily: string;
  fontSize: number;         // 2.5 - 10mm (ISO 3098)
  fontWeight: number;       // 100 - 900
  fontStyle: 'normal' | 'italic' | 'oblique';
  color: string;
  opacity: number;
  letterSpacing: number;    // -5 - 10
  lineHeight: number;       // 0.8 - 3.0
  textAlign: TextAlign;
  textBaseline: TextBaseline;

  // Shadow
  shadowEnabled: boolean;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlur: number;
  shadowColor: string;

  // Outline
  strokeEnabled: boolean;
  strokeWidth: number;
  strokeColor: string;

  // Background
  backgroundEnabled: boolean;
  backgroundColor: string;
  backgroundPadding: number;

  activeTemplate: string | null;
}

// ============================================================================
// GRIP SETTINGS
// ============================================================================

export interface GripColors {
  cold: string;     // Unselected (Blue - ACI 5)
  warm: string;     // Hover (Hot Pink)
  hot: string;      // Selected (Red - ACI 1)
  contour: string;  // Contour (Black)
}

export interface GripSettings {
  enabled: boolean;
  gripSize: number;         // 3 - 15 DIP
  pickBoxSize: number;      // 1 - 20 DIP
  apertureSize: number;     // 1 - 50 pixels
  opacity: number;
  colors: GripColors;
  showAperture: boolean;
  multiGripEdit: boolean;
  snapToGrips: boolean;
  showMidpoints: boolean;
  showCenters: boolean;
  showQuadrants: boolean;
  maxGripsPerEntity: number;
}

// ============================================================================
// VALIDATION FUNCTIONS με ISO Standards
// ============================================================================

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

export const validateLineSettings = (settings: Partial<LineSettings>): LineSettings => {
  const defaults: LineSettings = {
    enabled: true,
    lineType: 'solid',
    lineWidth: 0.25,
    color: '#FFFFFF',
    opacity: 1.0,
    dashScale: 1.0,
    dashOffset: 0,
    lineCap: 'butt',
    lineJoin: 'miter',
    breakAtCenter: false,
    hoverColor: '#FFFF00',
    hoverType: 'solid',
    hoverWidth: 0.35,
    hoverOpacity: 0.8,
    finalColor: '#00FF00',
    finalType: 'solid',
    finalWidth: 0.35,
    finalOpacity: 1.0,
    activeTemplate: null
  };

  return {
    ...defaults,
    ...settings,
    lineWidth: clamp(settings.lineWidth ?? defaults.lineWidth, 0.25, 2.0),
    opacity: clamp(settings.opacity ?? defaults.opacity, 0, 1),
    dashScale: clamp(settings.dashScale ?? defaults.dashScale, 0.5, 3.0),
    dashOffset: clamp(settings.dashOffset ?? defaults.dashOffset, 0, 100),
    hoverWidth: clamp(settings.hoverWidth ?? defaults.hoverWidth, 0.25, 2.0),
    hoverOpacity: clamp(settings.hoverOpacity ?? defaults.hoverOpacity, 0, 1),
    finalWidth: clamp(settings.finalWidth ?? defaults.finalWidth, 0.25, 2.0),
    finalOpacity: clamp(settings.finalOpacity ?? defaults.finalOpacity, 0, 1),
  };
};

export const validateTextSettings = (settings: Partial<TextSettings>): TextSettings => {
  const defaults: TextSettings = {
    enabled: true,
    fontFamily: 'Arial',
    fontSize: 3.5,
    fontWeight: 400,
    fontStyle: 'normal',
    color: '#FFFFFF',
    opacity: 1.0,
    letterSpacing: 0,
    lineHeight: 1.2,
    textAlign: 'left',
    textBaseline: 'alphabetic',
    shadowEnabled: false,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    shadowBlur: 0,
    shadowColor: '#000000',
    strokeEnabled: false,
    strokeWidth: 1,
    strokeColor: '#000000',
    backgroundEnabled: false,
    backgroundColor: '#000000',
    backgroundPadding: 4,
    activeTemplate: null
  };

  return {
    ...defaults,
    ...settings,
    fontSize: clamp(settings.fontSize ?? defaults.fontSize, 2.5, 10),
    fontWeight: clamp(settings.fontWeight ?? defaults.fontWeight, 100, 900),
    opacity: clamp(settings.opacity ?? defaults.opacity, 0, 1),
    letterSpacing: clamp(settings.letterSpacing ?? defaults.letterSpacing, -5, 10),
    lineHeight: clamp(settings.lineHeight ?? defaults.lineHeight, 0.8, 3.0),
    shadowBlur: clamp(settings.shadowBlur ?? defaults.shadowBlur, 0, 20),
    strokeWidth: clamp(settings.strokeWidth ?? defaults.strokeWidth, 0, 5),
    backgroundPadding: clamp(settings.backgroundPadding ?? defaults.backgroundPadding, 0, 20),
  };
};

export const validateGripSettings = (settings: Partial<GripSettings>): GripSettings => {
  const defaults: GripSettings = {
    enabled: true,
    gripSize: 5,
    pickBoxSize: 3,
    apertureSize: 10,
    opacity: 1.0,
    colors: {
      cold: '#0000FF',
      warm: '#FF69B4',
      hot: '#FF0000',
      contour: '#000000'
    },
    showAperture: true,
    multiGripEdit: true,
    snapToGrips: true,
    showMidpoints: true,
    showCenters: true,
    showQuadrants: true,
    maxGripsPerEntity: 50
  };

  return {
    ...defaults,
    ...settings,
    gripSize: clamp(settings.gripSize ?? defaults.gripSize, 3, 15),
    pickBoxSize: clamp(settings.pickBoxSize ?? defaults.pickBoxSize, 1, 20),
    apertureSize: clamp(settings.apertureSize ?? defaults.apertureSize, 1, 50),
    opacity: clamp(settings.opacity ?? defaults.opacity, 0, 1),
    maxGripsPerEntity: clamp(settings.maxGripsPerEntity ?? defaults.maxGripsPerEntity, 1, 100),
  };
};

// ============================================================================
// ENTITY ID TYPE
// ============================================================================

export type EntityId = string;

// ============================================================================
// COMBINED SETTINGS TYPE
// ============================================================================

export interface DxfSettings {
  line: LineSettings;
  text: TextSettings;
  grip: GripSettings;
}

export type PartialDxfSettings = {
  line?: Partial<LineSettings>;
  text?: Partial<TextSettings>;
  grip?: Partial<GripSettings>;
};