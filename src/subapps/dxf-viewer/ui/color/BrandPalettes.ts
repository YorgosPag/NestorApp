/**
 * 🏢 ENTERPRISE COLOR SYSTEM - Brand Palettes
 *
 * @version 1.0.0
 * @description Centralized color palettes for brand, UI, and semantic colors
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI) + ChatGPT-5
 * @since 2025-10-07
 */

import type { ColorPalette, ColorSwatch } from './types';

// ===== BRAND COLORS =====

const BRAND_SWATCHES: ColorSwatch[] = [
  { color: '#2563eb', name: 'Primary Blue', semantic: 'primary' },
  { color: '#1d4ed8', name: 'Primary Dark', semantic: 'primary' },
  { color: '#3b82f6', name: 'Primary Light', semantic: 'primary' },
  { color: '#64748b', name: 'Secondary Gray', semantic: 'secondary' },
  { color: '#475569', name: 'Secondary Dark', semantic: 'secondary' },
  { color: '#94a3b8', name: 'Secondary Light', semantic: 'secondary' },
];

export const BRAND_PALETTE: ColorPalette = {
  id: 'brand',
  name: 'Brand Colors',
  description: 'Primary and secondary brand colors',
  colors: BRAND_SWATCHES,
};

// ===== SEMANTIC COLORS =====

const SEMANTIC_SWATCHES: ColorSwatch[] = [
  { color: '#22c55e', name: 'Success', semantic: 'success' },
  { color: '#16a34a', name: 'Success Dark', semantic: 'success' },
  { color: '#4ade80', name: 'Success Light', semantic: 'success' },
  { color: '#f59e0b', name: 'Warning', semantic: 'warning' },
  { color: '#d97706', name: 'Warning Dark', semantic: 'warning' },
  { color: '#fbbf24', name: 'Warning Light', semantic: 'warning' },
  { color: '#ef4444', name: 'Danger', semantic: 'danger' },
  { color: '#dc2626', name: 'Danger Dark', semantic: 'danger' },
  { color: '#f87171', name: 'Danger Light', semantic: 'danger' },
  { color: '#3b82f6', name: 'Info', semantic: 'info' },
  { color: '#2563eb', name: 'Info Dark', semantic: 'info' },
  { color: '#60a5fa', name: 'Info Light', semantic: 'info' },
];

export const SEMANTIC_PALETTE: ColorPalette = {
  id: 'semantic',
  name: 'Semantic Colors',
  description: 'Success, warning, danger, and info colors',
  colors: SEMANTIC_SWATCHES,
};

// ===== UI COLORS =====

const UI_SWATCHES: ColorSwatch[] = [
  { color: '#ffffff', name: 'White', category: 'background' },
  { color: '#f8fafc', name: 'Gray 50', category: 'background' },
  { color: '#f1f5f9', name: 'Gray 100', category: 'background' },
  { color: '#e2e8f0', name: 'Gray 200', category: 'border' },
  { color: '#cbd5e1', name: 'Gray 300', category: 'border' },
  { color: '#94a3b8', name: 'Gray 400', category: 'text' },
  { color: '#64748b', name: 'Gray 500', category: 'text' },
  { color: '#475569', name: 'Gray 600', category: 'text' },
  { color: '#334155', name: 'Gray 700', category: 'background' },
  { color: '#1e293b', name: 'Gray 800', category: 'background' },
  { color: '#0f172a', name: 'Gray 900', category: 'background' },
  { color: '#000000', name: 'Black', category: 'text' },
];

export const UI_PALETTE: ColorPalette = {
  id: 'ui',
  name: 'UI Colors',
  description: 'Text, background, border, and overlay colors',
  colors: UI_SWATCHES,
};

// ===== DXF SPECIFIC COLORS =====

const DXF_SWATCHES: ColorSwatch[] = [
  { color: '#ff0000', name: 'Red', category: 'entity' },
  { color: '#ffff00', name: 'Yellow', category: 'entity' },
  { color: '#00ff00', name: 'Green', category: 'entity' },
  { color: '#00ffff', name: 'Cyan', category: 'entity' },
  { color: '#0000ff', name: 'Blue', category: 'entity' },
  { color: '#ff00ff', name: 'Magenta', category: 'entity' },
  { color: '#ffffff', name: 'White', category: 'entity' },
  { color: '#808080', name: 'Gray', category: 'entity' },
  { color: '#c0c0c0', name: 'Light Gray', category: 'entity' },
  { color: '#ff8080', name: 'Light Red', category: 'entity' },
  { color: '#ffff80', name: 'Light Yellow', category: 'entity' },
  { color: '#80ff80', name: 'Light Green', category: 'entity' },
  { color: '#80ffff', name: 'Light Cyan', category: 'entity' },
  { color: '#8080ff', name: 'Light Blue', category: 'entity' },
  { color: '#ff80ff', name: 'Light Magenta', category: 'entity' },
  { color: '#800000', name: 'Dark Red', category: 'entity' },
  { color: '#808000', name: 'Dark Yellow', category: 'entity' },
  { color: '#008000', name: 'Dark Green', category: 'entity' },
  { color: '#008080', name: 'Dark Cyan', category: 'entity' },
  { color: '#000080', name: 'Dark Blue', category: 'entity' },
  { color: '#800080', name: 'Dark Magenta', category: 'entity' },
];

export const DXF_PALETTE: ColorPalette = {
  id: 'dxf',
  name: 'DXF Colors',
  description: 'AutoCAD-style entity colors',
  colors: DXF_SWATCHES,
};

// ===== MATERIAL DESIGN COLORS =====

const MATERIAL_SWATCHES: ColorSwatch[] = [
  { color: '#f44336', name: 'Red 500', category: 'material' },
  { color: '#e91e63', name: 'Pink 500', category: 'material' },
  { color: '#9c27b0', name: 'Purple 500', category: 'material' },
  { color: '#673ab7', name: 'Deep Purple 500', category: 'material' },
  { color: '#3f51b5', name: 'Indigo 500', category: 'material' },
  { color: '#2196f3', name: 'Blue 500', category: 'material' },
  { color: '#03a9f4', name: 'Light Blue 500', category: 'material' },
  { color: '#00bcd4', name: 'Cyan 500', category: 'material' },
  { color: '#009688', name: 'Teal 500', category: 'material' },
  { color: '#4caf50', name: 'Green 500', category: 'material' },
  { color: '#8bc34a', name: 'Light Green 500', category: 'material' },
  { color: '#cddc39', name: 'Lime 500', category: 'material' },
  { color: '#ffeb3b', name: 'Yellow 500', category: 'material' },
  { color: '#ffc107', name: 'Amber 500', category: 'material' },
  { color: '#ff9800', name: 'Orange 500', category: 'material' },
  { color: '#ff5722', name: 'Deep Orange 500', category: 'material' },
  { color: '#795548', name: 'Brown 500', category: 'material' },
  { color: '#9e9e9e', name: 'Gray 500', category: 'material' },
  { color: '#607d8b', name: 'Blue Gray 500', category: 'material' },
];

export const MATERIAL_PALETTE: ColorPalette = {
  id: 'material',
  name: 'Material Design',
  description: 'Material Design color palette',
  colors: MATERIAL_SWATCHES,
};

// ===== PALETTE REGISTRY =====

/**
 * All available palettes
 */
export const ALL_PALETTES: ColorPalette[] = [
  BRAND_PALETTE,
  SEMANTIC_PALETTE,
  UI_PALETTE,
  DXF_PALETTE,
  MATERIAL_PALETTE,
];

/**
 * Default palette order for picker
 */
export const DEFAULT_PALETTES = ['brand', 'semantic', 'dxf'];

/**
 * Get palette by ID
 */
export function getPaletteById(id: string): ColorPalette | undefined {
  return ALL_PALETTES.find((p) => p.id === id);
}

/**
 * Get palettes by IDs
 */
export function getPalettesByIds(ids: string[]): ColorPalette[] {
  return ids
    .map((id) => getPaletteById(id))
    .filter((p): p is ColorPalette => p !== undefined);
}

/**
 * Get all colors from multiple palettes
 */
export function getAllColorsFromPalettes(paletteIds: string[]): ColorSwatch[] {
  const palettes = getPalettesByIds(paletteIds);
  return palettes.flatMap((p) => p.colors);
}

/**
 * Find color swatch by hex value
 */
export function findSwatchByColor(color: string): ColorSwatch | undefined {
  const normalized = color.toLowerCase();
  for (const palette of ALL_PALETTES) {
    const swatch = palette.colors.find((s) => s.color.toLowerCase() === normalized);
    if (swatch) return swatch;
  }
  return undefined;
}
