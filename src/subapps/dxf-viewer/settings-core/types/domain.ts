/**
 * @file Domain Types for DXF Settings
 * @module settings-core/types/domain
 *
 * ENTERPRISE STANDARD - Single Source of Truth for Domain Types
 *
 * Contains all domain/business types with ISO standards:
 * - LineSettings (ISO 128)
 * - TextSettings (ISO 3098)
 * - GripSettings (AutoCAD standards)
 * - Validation functions
 *
 * @see state.ts for state management types (ViewerMode, SettingsState, etc.)
 * @version 2.0.0
 * @since 2026-01-01
 */

import { UI_COLORS } from '../../config/color-config';
// 🏢 ADR-071: Centralized clamp function
import { clamp } from '../../rendering/entities/shared/geometry-utils';
// 🏢 ADR-076: Centralized Color Conversion
import { rgbToHex as centralizedRgbToHex } from '../../ui/color/utils';
// 🏢 ADR-034: Centralized Validation Bounds
import {
  OPACITY_BOUNDS,
  TEXT_BOUNDS,
  LINE_BOUNDS,
  GRIP_BOUNDS,
} from '../../config/validation-bounds-config';

// ============================================================================
// LINE TYPES & SETTINGS (ISO 128)
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
// TEXT TYPES & SETTINGS (ISO 3098)
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

  // Boolean text styling (backward compatibility)
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
  isSuperscript: boolean;
  isSubscript: boolean;

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
// GRIP TYPES & SETTINGS (AutoCAD Standards)
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
  showGrips: boolean;
}

// ============================================================================
// ENTERPRISE SETTINGS (Cursor, Grid, Ruler)
// ============================================================================

export interface EnterpriseCursorSettings {
  enabled: boolean;
  crosshairSize: number;      // % of viewport
  crosshairColor: string;
  cursorSize: number;         // pixels
  cursorColor: string;
}

export interface EnterpriseGridSettings {
  enabled: boolean;
  spacing: number;
  majorLineInterval: number;
  color: string;
  majorColor: string;
  opacity: number;
  style: 'lines' | 'dots' | 'crosses';
}

export interface EnterpriseRulerSettings {
  enabled: boolean;
  unit: 'mm' | 'cm' | 'm' | 'in' | 'ft';
  fontSize: number;
  textColor: string;
  backgroundColor: string;
}

// ============================================================================
// COMBINED SETTINGS TYPE
// ============================================================================

export interface DxfSettings {
  line: LineSettings;
  text: TextSettings;
  grip: GripSettings;
  cursor?: EnterpriseCursorSettings;
  grid?: EnterpriseGridSettings;
  ruler?: EnterpriseRulerSettings;
}

export type PartialDxfSettings = {
  line?: Partial<LineSettings>;
  text?: Partial<TextSettings>;
  grip?: Partial<GripSettings>;
  cursor?: Partial<EnterpriseCursorSettings>;
  grid?: Partial<EnterpriseGridSettings>;
  ruler?: Partial<EnterpriseRulerSettings>;
};

// ============================================================================
// ENTITY ID TYPE
// ============================================================================

export type EntityId = string;

// ============================================================================
// VALIDATION FUNCTIONS (ISO Standards)
// 🏢 ADR-071: Using centralized clamp from geometry-utils.ts
// ============================================================================

export const validateLineWidth = (value: number | null | undefined): number => {
  if (value == null || isNaN(value) || typeof value !== 'number') {
    return 1;
  }
  // 🏢 ADR-034: Centralized validation bounds
  return clamp(value, LINE_BOUNDS.WIDTH.min, LINE_BOUNDS.WIDTH.max);
};

export const validateColor = (value: string | null | undefined): string => {
  if (!value || typeof value !== 'string') {
    return UI_COLORS.WHITE;
  }

  let color = value.trim();

  if (/^[0-9A-Fa-f]{3,6}$/.test(color)) {
    color = '#' + color;
  }

  if (/^#[0-9A-Fa-f]{3}$/.test(color)) {
    const hex = color.substring(1);
    color = '#' + hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
    switch (color.toLowerCase()) {
      case '#ffffff': return UI_COLORS.WHITE;
      case '#000000': return UI_COLORS.BLACK;
      case '#ff0000': return UI_COLORS.SELECTED_RED;
      case '#0080ff': return UI_COLORS.INDICATOR_BLUE;
      case '#aabbcc': return UI_COLORS.LIGHT_GRAY_ALT;
      default: return color;
    }
  }

  const rgbMatch = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch.map(Number);
    if (r === 255 && g === 0 && b === 0) return UI_COLORS.SELECTED_RED;
    if (r === 0 && g === 128 && b === 255) return UI_COLORS.INDICATOR_BLUE;
    // 🏢 ADR-076: Use centralized rgbToHex
    return centralizedRgbToHex({ r, g, b });
  }

  return UI_COLORS.WHITE;
};

export const validateFontSize = (value: number | null | undefined): number => {
  if (value == null || isNaN(value) || typeof value !== 'number') {
    return 14;
  }
  // 🏢 ADR-034: Centralized validation bounds
  return clamp(value, TEXT_BOUNDS.FONT_SIZE.min, TEXT_BOUNDS.FONT_SIZE.max);
};

export const validateGripSize = (value: number | null | undefined): number => {
  if (value == null || isNaN(value) || typeof value !== 'number') {
    return 5;
  }
  // 🏢 ADR-034: Centralized validation bounds
  return clamp(value, GRIP_BOUNDS.SIZE.min, GRIP_BOUNDS.SIZE.max);
};

export const validateLineSettings = (settings: Partial<LineSettings>): LineSettings => {
  const defaults: LineSettings = {
    enabled: true,
    lineType: 'solid',
    lineWidth: 1,
    color: UI_COLORS.WHITE,
    opacity: 1.0,
    dashScale: 1.0,
    dashOffset: 0,
    lineCap: 'butt',
    lineJoin: 'miter',
    breakAtCenter: false,
    hoverColor: UI_COLORS.BRIGHT_YELLOW,
    hoverType: 'solid',
    hoverWidth: 1,
    hoverOpacity: 0.8,
    finalColor: UI_COLORS.BRIGHT_GREEN,
    finalType: 'solid',
    finalWidth: 1,
    finalOpacity: 1.0,
    activeTemplate: null
  };

  const validatedSettings: Partial<LineSettings> = { ...settings };

  if (settings.lineType && !['solid', 'dashed', 'dotted', 'dash-dot', 'dash-dot-dot'].includes(settings.lineType)) {
    validatedSettings.lineType = 'solid';
  }

  // 🏢 ADR-034: All clamp operations use centralized validation bounds
  return {
    ...defaults,
    ...validatedSettings,
    lineWidth: validateLineWidth(settings.lineWidth) ?? defaults.lineWidth,
    color: validateColor(settings.color) ?? defaults.color,
    opacity: clamp(settings.opacity ?? defaults.opacity, OPACITY_BOUNDS.STANDARD.min, OPACITY_BOUNDS.STANDARD.max),
    dashScale: clamp(settings.dashScale ?? defaults.dashScale, LINE_BOUNDS.DASH_SCALE.min, LINE_BOUNDS.DASH_SCALE.max),
    dashOffset: clamp(settings.dashOffset ?? defaults.dashOffset, LINE_BOUNDS.DASH_OFFSET.min, LINE_BOUNDS.DASH_OFFSET.max),
    hoverWidth: validateLineWidth(settings.hoverWidth) ?? defaults.hoverWidth,
    hoverOpacity: clamp(settings.hoverOpacity ?? defaults.hoverOpacity, OPACITY_BOUNDS.STANDARD.min, OPACITY_BOUNDS.STANDARD.max),
    finalWidth: validateLineWidth(settings.finalWidth) ?? defaults.finalWidth,
    finalOpacity: clamp(settings.finalOpacity ?? defaults.finalOpacity, OPACITY_BOUNDS.STANDARD.min, OPACITY_BOUNDS.STANDARD.max),
  };
};

export const validateTextSettings = (settings: Partial<TextSettings>): TextSettings => {
  const defaults: TextSettings = {
    enabled: true,
    fontFamily: 'Arial',
    fontSize: 14,
    fontWeight: 400,
    fontStyle: 'normal',
    color: UI_COLORS.WHITE,
    opacity: 1.0,
    letterSpacing: 0,
    lineHeight: 1.2,
    textAlign: 'left',
    textBaseline: 'alphabetic',
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isStrikethrough: false,
    isSuperscript: false,
    isSubscript: false,
    shadowEnabled: false,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    shadowBlur: 0,
    shadowColor: UI_COLORS.BLACK,
    strokeEnabled: false,
    strokeWidth: 1,
    strokeColor: UI_COLORS.BLACK,
    backgroundEnabled: false,
    backgroundColor: UI_COLORS.BLACK,
    backgroundPadding: 4,
    activeTemplate: null
  };

  const validatedSettings: Partial<TextSettings> = { ...settings };

  const validFonts = ['Arial', 'Times New Roman', 'Courier New', 'monospace'];
  if (settings.fontFamily && !validFonts.includes(settings.fontFamily)) {
    validatedSettings.fontFamily = 'Arial';
  }

  if (settings.fontStyle && !['normal', 'italic', 'oblique'].includes(settings.fontStyle)) {
    validatedSettings.fontStyle = 'normal';
  }

  // 🏢 ADR-034: All clamp operations use centralized validation bounds
  return {
    ...defaults,
    ...validatedSettings,
    fontSize: validateFontSize(settings.fontSize) ?? defaults.fontSize,
    fontWeight: clamp(settings.fontWeight ?? defaults.fontWeight, TEXT_BOUNDS.FONT_WEIGHT.min, TEXT_BOUNDS.FONT_WEIGHT.max),
    color: validateColor(settings.color) ?? defaults.color,
    opacity: clamp(settings.opacity ?? defaults.opacity, OPACITY_BOUNDS.STANDARD.min, OPACITY_BOUNDS.STANDARD.max),
    letterSpacing: clamp(settings.letterSpacing ?? defaults.letterSpacing, TEXT_BOUNDS.LETTER_SPACING.min, TEXT_BOUNDS.LETTER_SPACING.max),
    lineHeight: clamp(settings.lineHeight ?? defaults.lineHeight, TEXT_BOUNDS.LINE_HEIGHT.min, TEXT_BOUNDS.LINE_HEIGHT.max),
    shadowBlur: clamp(settings.shadowBlur ?? defaults.shadowBlur, TEXT_BOUNDS.SHADOW_BLUR.min, TEXT_BOUNDS.SHADOW_BLUR.max),
    strokeWidth: clamp(settings.strokeWidth ?? defaults.strokeWidth, TEXT_BOUNDS.STROKE_WIDTH.min, TEXT_BOUNDS.STROKE_WIDTH.max),
    backgroundPadding: clamp(settings.backgroundPadding ?? defaults.backgroundPadding, TEXT_BOUNDS.BACKGROUND_PADDING.min, TEXT_BOUNDS.BACKGROUND_PADDING.max),
  };
};

export const validateGripSettings = (settings: Partial<GripSettings>): GripSettings => {
  const defaults: GripSettings = {
    enabled: true,
    gripSize: 7,
    pickBoxSize: 3,
    apertureSize: 10,
    opacity: 1.0,
    colors: {
      cold: UI_COLORS.SNAP_CENTER,
      warm: UI_COLORS.SNAP_INTERSECTION,
      hot: UI_COLORS.SNAP_ENDPOINT,
      contour: UI_COLORS.BLACK
    },
    showAperture: true,
    multiGripEdit: true,
    snapToGrips: true,
    showMidpoints: true,
    showCenters: true,
    showQuadrants: true,
    maxGripsPerEntity: 50,
    showGrips: true
  };

  const validatedSettings: Partial<GripSettings> = { ...settings };

  if (settings.colors) {
    const validatedColors = { ...defaults.colors };
    if (settings.colors.cold) validatedColors.cold = validateColor(settings.colors.cold) ?? defaults.colors.cold;
    if (settings.colors.warm) validatedColors.warm = validateColor(settings.colors.warm) ?? defaults.colors.warm;
    if (settings.colors.hot) validatedColors.hot = validateColor(settings.colors.hot) ?? defaults.colors.hot;
    if (settings.colors.contour) validatedColors.contour = validateColor(settings.colors.contour) ?? defaults.colors.contour;
    validatedSettings.colors = validatedColors;
  }

  // 🏢 ADR-034: All clamp operations use centralized validation bounds
  return {
    ...defaults,
    ...validatedSettings,
    gripSize: validateGripSize(settings.gripSize) ?? defaults.gripSize,
    pickBoxSize: clamp(settings.pickBoxSize ?? defaults.pickBoxSize, GRIP_BOUNDS.PICK_BOX_REFINED.min, GRIP_BOUNDS.PICK_BOX_REFINED.max),
    apertureSize: clamp(settings.apertureSize ?? defaults.apertureSize, GRIP_BOUNDS.APERTURE.min, GRIP_BOUNDS.APERTURE.max),
    opacity: clamp(settings.opacity ?? defaults.opacity, OPACITY_BOUNDS.STANDARD.min, OPACITY_BOUNDS.STANDARD.max),
    maxGripsPerEntity: clamp(settings.maxGripsPerEntity ?? defaults.maxGripsPerEntity, GRIP_BOUNDS.MAX_PER_ENTITY_LEGACY.min, GRIP_BOUNDS.MAX_PER_ENTITY_LEGACY.max),
  };
};
