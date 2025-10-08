/**
 * 🏢 ENTERPRISE COLOR SYSTEM - Public API
 *
 * @version 1.0.0
 * @description Central export point for Enterprise Color System
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI) + ChatGPT-5
 * @since 2025-10-07
 */

// ===== MAIN COMPONENTS =====
export { EnterpriseColorPicker } from './EnterpriseColorPicker';
export { EnterpriseColorDialog, ColorDialogTrigger } from './EnterpriseColorDialog';
export { EnterpriseColorField } from './EnterpriseColorField';
export { EnterpriseColorArea, EnterpriseColorAreaWithLabel } from './EnterpriseColorArea';
export {
  EnterpriseColorSlider,
  HueSlider,
  AlphaSlider,
  SaturationSlider,
  BrightnessSlider,
} from './EnterpriseColorSlider';
export { SwatchesPalette } from './SwatchesPalette';

// ===== TYPES =====
export type {
  ColorMode,
  PickerVariant,
  ColorValue,
  RGBColor,
  HSLColor,
  HSVColor,
  ContrastResult,
  TextSize,
  ColorSwatch,
  ColorPalette,
  ColorPickerLabels,
  EnterpriseColorPickerProps,
  EnterpriseColorFieldProps,
  EnterpriseColorDialogProps,
  ColorChangeEvent,
  ModeChangeEvent,
  ParseResult,
  FormatOptions,
} from './types';

// ===== PALETTES =====
export {
  BRAND_PALETTE,
  SEMANTIC_PALETTE,
  UI_PALETTE,
  DXF_PALETTE,
  MATERIAL_PALETTE,
  ALL_PALETTES,
  DEFAULT_PALETTES,
  getPaletteById,
  getPalettesByIds,
  getAllColorsFromPalettes,
  findSwatchByColor,
} from './BrandPalettes';

// ===== STORE & HOOKS =====
export {
  createRecentColorsStore,
  getRecentColorsStore,
  resetRecentColorsStore,
  useRecentColors,
} from './RecentColorsStore';

export {
  useContrast,
  useContrastCheck,
  calculateContrast,
  findAccessibleColor,
} from './hooks/useContrast';

// ===== UTILITIES =====
export {
  parseHex,
  parseRgb,
  parseHsl,
  parseColor,
  rgbToHex,
  formatRgb,
  formatHsl,
  rgbToHsl,
  hslToRgb,
  rgbToHsv,
  hsvToRgb,
  isValidHex,
  normalizeHex,
} from './utils';
