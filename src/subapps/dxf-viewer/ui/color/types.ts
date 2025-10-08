/**
 * 🏢 ENTERPRISE COLOR SYSTEM - Types
 *
 * @version 1.0.0
 * @package React Aria Color System
 * @description Complete type definitions for Enterprise Color Picker
 *
 * @see https://react-spectrum.adobe.com/react-aria/useColorField.html
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI) + ChatGPT-5
 * @since 2025-10-07
 */

// ===== COLOR MODES =====

/**
 * Supported color representation modes
 */
export type ColorMode = 'hex' | 'rgb' | 'hsl' | 'hsv';

/**
 * Picker display variants
 */
export type PickerVariant = 'inline' | 'popover' | 'dialog';

// ===== COLOR VALUE TYPES =====

/**
 * Color value in different formats
 */
export interface ColorValue {
  /** Hex format: #RRGGBB or #RRGGBBAA */
  hex: string;
  /** RGB format */
  rgb: RGBColor;
  /** HSL format */
  hsl: HSLColor;
  /** HSV format */
  hsv: HSVColor;
  /** Alpha channel (0-1) */
  alpha: number;
}

/**
 * RGB Color representation
 */
export interface RGBColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a?: number; // 0-1
}

/**
 * HSL Color representation
 */
export interface HSLColor {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
  a?: number; // 0-1
}

/**
 * HSV Color representation
 */
export interface HSVColor {
  h: number; // 0-360
  s: number; // 0-100
  v: number; // 0-100
  a?: number; // 0-1
}

// ===== CONTRAST & WCAG =====

/**
 * WCAG contrast ratio result
 */
export interface ContrastResult {
  /** Contrast ratio (1-21) */
  ratio: number;
  /** AA compliance for normal text (4.5:1) */
  passAA: boolean;
  /** AAA compliance for normal text (7:1) */
  passAAA: boolean;
  /** AA compliance for large text (3:1) */
  passAALarge: boolean;
  /** AAA compliance for large text (4.5:1) */
  passAAALarge: boolean;
  /** Human-readable ratio string */
  ratioString: string;
}

/**
 * Text size categories for WCAG
 */
export type TextSize = 'normal' | 'large';

// ===== PALETTE TYPES =====

/**
 * Color swatch in a palette
 */
export interface ColorSwatch {
  /** Hex color value */
  color: string;
  /** Display name */
  name: string;
  /** Optional category */
  category?: string;
  /** Optional semantic meaning */
  semantic?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
}

/**
 * Color palette definition
 */
export interface ColorPalette {
  /** Unique palette ID */
  id: string;
  /** Display name */
  name: string;
  /** Palette description */
  description?: string;
  /** Color swatches */
  colors: ColorSwatch[];
}

// ===== COMPONENT PROPS =====

/**
 * Labels for internationalization
 */
export interface ColorPickerLabels {
  picker?: string;
  field?: string;
  alpha?: string;
  hue?: string;
  saturation?: string;
  value?: string;
  hex?: string;
  rgb?: string;
  hsl?: string;
  hsv?: string;
  red?: string;
  green?: string;
  blue?: string;
  lightness?: string;
  contrast?: string;
  recent?: string;
  eyedropper?: string;
  copy?: string;
  reset?: string;
  cancel?: string;
  apply?: string;
}

/**
 * Main Enterprise Color Picker Props
 */
export interface EnterpriseColorPickerProps {
  /** Current color value in hex format (#RRGGBB or #RRGGBBAA) */
  value: string;

  /** Callback fired on every color change (live) */
  onChange: (color: string) => void;

  /** Callback fired when color change is committed (e.g., mouse up, blur) */
  onChangeEnd?: (color: string) => void;

  /** Enable alpha channel editing (default: true) */
  alpha?: boolean;

  /** Available color modes (default: ["hex", "rgb", "hsl"]) */
  modes?: ColorMode[];

  /** Brand palette IDs to display */
  palettes?: string[];

  /** Show recent colors (default: true, LRU 10) */
  recent?: boolean;

  /** Enable eyedropper tool if supported (default: true) */
  eyedropper?: boolean;

  /** Picker display variant (default: "popover") */
  variant?: PickerVariant;

  /** Disabled state */
  disabled?: boolean;

  /** Read-only state */
  readOnly?: boolean;

  /** Custom labels for i18n */
  labels?: ColorPickerLabels;

  /** Additional CSS class */
  className?: string;

  /** Show contrast checker panel (default: false) */
  showContrast?: boolean;

  /** Background color for contrast checking */
  contrastBackground?: string;

  /** Callback when mode changes */
  onModeChange?: (mode: ColorMode) => void;
}

/**
 * Enterprise Color Field Props
 */
export interface EnterpriseColorFieldProps {
  /** Current color value */
  value: string;

  /** Change callback */
  onChange: (color: string) => void;

  /** Current color mode */
  mode: ColorMode;

  /** Enable alpha channel */
  alpha?: boolean;

  /** Disabled state */
  disabled?: boolean;

  /** Read-only state */
  readOnly?: boolean;

  /** Custom labels */
  labels?: ColorPickerLabels;

  /** Additional CSS class */
  className?: string;
}

/**
 * Enterprise Color Dialog Props
 */
export interface EnterpriseColorDialogProps extends EnterpriseColorPickerProps {
  /** Dialog open state */
  isOpen: boolean;

  /** Close callback */
  onClose: () => void;

  /** Dialog title */
  title?: string;

  /** Show footer actions */
  showFooter?: boolean;
}

// ===== STORE TYPES =====

/**
 * Recent colors store state
 */
export interface RecentColorsState {
  /** List of recent colors (LRU order) */
  colors: string[];

  /** Maximum number of colors to store */
  maxColors: number;
}

/**
 * Recent colors store actions
 */
export interface RecentColorsActions {
  /** Add a color to recent list */
  addColor: (color: string) => void;

  /** Clear all recent colors */
  clear: () => void;

  /** Load colors from storage */
  load: () => void;

  /** Save colors to storage */
  save: () => void;
}

// ===== EVENT TYPES =====

/**
 * Color change event
 */
export interface ColorChangeEvent {
  /** New color value */
  color: string;

  /** Previous color value */
  previousColor: string;

  /** Color mode that triggered the change */
  mode: ColorMode;

  /** Whether this is a committed change (vs live) */
  committed: boolean;
}

/**
 * Mode change event
 */
export interface ModeChangeEvent {
  /** New mode */
  mode: ColorMode;

  /** Previous mode */
  previousMode: ColorMode;
}

// ===== UTILITY TYPES =====

/**
 * Color parser result
 */
export interface ParseResult {
  /** Whether parsing was successful */
  valid: boolean;

  /** Parsed color value (if valid) */
  color?: ColorValue;

  /** Error message (if invalid) */
  error?: string;
}

/**
 * Color format options
 */
export interface FormatOptions {
  /** Include alpha channel */
  alpha?: boolean;

  /** Uppercase hex letters */
  uppercase?: boolean;

  /** Use short hex notation when possible (#RGB vs #RRGGBB) */
  short?: boolean;
}
