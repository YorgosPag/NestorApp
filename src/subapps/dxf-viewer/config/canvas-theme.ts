'use client';

/**
 * 🏢 ADR-004 — Canvas Theme SSoT
 *
 * Single source of truth for the DXF canvas background themes (AutoCAD Classic/Dark,
 * SolidWorks, Blender, Light, Cinema 4D, custom): the theme catalogue + the DOM apply
 * logic (CSS custom properties on `:root`) + the localStorage-driven startup restore.
 *
 * Two consumers share this:
 *  - `BackgroundCategory.tsx` (settings UI) — lets the user pick a theme and applies it
 *    live (CSS side here + grid colours via the RulersGrid context, which it owns).
 *  - `applySavedCanvasThemeCss()` — called ONCE at DXF-viewer mount so the saved theme is
 *    applied on a fresh load WITHOUT the (lazy) settings panel having to be opened. This
 *    is the fix for «background resets after hard refresh»: persistence always worked, but
 *    application used to be coupled to the lazy `BackgroundCategory` mount effect — on a
 *    cold load nothing re-applied the saved CSS vars until that exact tab was reopened.
 *
 * Grid colours are intentionally NOT applied here — they round-trip through the RulersGrid
 * persistence (`rulers-grid-persistence`) and are restored by that system; re-applying them
 * at startup would clobber the user's own grid edits. The settings UI still applies them
 * live on pick (it has the RulersGrid context).
 */

import { storageGet, STORAGE_KEYS } from '../utils/storage-utils';

// ─── Theme definitions ────────────────────────────────────────────────────────

export type ThemeKey =
  | 'autocadClassic'
  | 'autocadDark'
  | 'solidworks'
  | 'blender'
  | 'light'
  | 'cinema4d'
  | 'custom';

export interface ThemeConfig {
  key: ThemeKey;
  /** CSS value applied to `--canvas-background-dxf` (solid base — CSS var or hex). */
  cssValue: string;
  /** Optional vertical gradient image for `--canvas-background-dxf-image` (2D canvas). */
  gradientImage?: string;
  /** Optional explicit gradient stops for the 3D studio background (`--canvas-gradient-*`). */
  gradientTop?: string;
  gradientBottom?: string;
  /** Optional theme grid colours (palette `var(--canvas-grid-*)`, resolved to hex → RulersGrid context). */
  gridMajor?: string;
  gridMinor?: string;
  swatchClass: string;
  textClass: string;
}

export const PRESET_THEMES: ThemeConfig[] = [
  { key: 'autocadClassic', cssValue: 'var(--canvas-themes-autocad-classic)', swatchClass: 'bg-black border-border',             textClass: 'text-muted-foreground' },
  { key: 'autocadDark',    cssValue: 'var(--canvas-themes-autocad-dark)',    swatchClass: 'bg-[#1a1a1a] border-border',          textClass: 'text-muted-foreground' },
  { key: 'solidworks',     cssValue: 'var(--canvas-themes-solidworks)',      swatchClass: 'bg-[#2d3748] border-border',          textClass: 'text-muted-foreground' },
  { key: 'blender',        cssValue: 'var(--canvas-themes-blender)',         swatchClass: 'bg-[#232323] border-border',          textClass: 'text-muted-foreground' },
  { key: 'light',          cssValue: 'var(--canvas-themes-light)',           swatchClass: 'bg-white border-border',              textClass: 'text-foreground' },
  {
    key: 'cinema4d',
    cssValue: 'var(--canvas-themes-cinema4d)',
    gradientImage: 'linear-gradient(to bottom, var(--canvas-gradient-cinema4d-top), var(--canvas-gradient-cinema4d-bottom))',
    gradientTop: 'var(--canvas-gradient-cinema4d-top)',
    gradientBottom: 'var(--canvas-gradient-cinema4d-bottom)',
    gridMajor: 'var(--canvas-grid-cinema4d-major)',
    gridMinor: 'var(--canvas-grid-cinema4d-minor)',
    swatchClass: 'bg-gradient-to-b from-[#5b5b5b] to-[#868686] border-border',
    textClass: 'text-muted-foreground',
  },
];

export const DEFAULT_THEME: ThemeKey = 'autocadClassic';
export const DEFAULT_CUSTOM_COLOR = '#1e293b';

/** Active canvas-theme CSS variables (set on `:root` by the theme switch). */
const CANVAS_THEME_VARS = {
  base: '--canvas-background-dxf',
  image: '--canvas-background-dxf-image',
  gradientTop: '--canvas-gradient-top',
  gradientBottom: '--canvas-gradient-bottom',
} as const;

function setOrClear(root: CSSStyleDeclaration, name: string, value?: string): void {
  if (value) root.setProperty(name, value);
  else root.removeProperty(name);
}

/**
 * Apply the CSS side of a canvas theme (Cinema 4D-style scheme): solid base + optional vertical
 * gradient (2D image + 3D stops) — one place so 2D and 3D move together. Solid themes clear the
 * gradient vars (→ flat background). Grid colours are applied separately into the RulersGrid
 * context (Canvas2D `ctx.strokeStyle` cannot read CSS vars).
 */
export function applyCanvasTheme(
  theme: Pick<ThemeConfig, 'cssValue' | 'gradientImage' | 'gradientTop' | 'gradientBottom'>,
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  root.setProperty(CANVAS_THEME_VARS.base, theme.cssValue);
  root.setProperty(CANVAS_THEME_VARS.image, theme.gradientImage ?? 'none');
  setOrClear(root, CANVAS_THEME_VARS.gradientTop, theme.gradientTop);
  setOrClear(root, CANVAS_THEME_VARS.gradientBottom, theme.gradientBottom);
}

/**
 * Read the saved canvas theme from localStorage and apply ONLY its CSS side to `:root`.
 *
 * Called once at DXF-viewer mount (see `DxfViewerContent`) so the user's chosen background
 * survives a hard refresh without opening the lazy settings panel. Safe to call repeatedly
 * and off-DOM (SSR / tests): `applyCanvasTheme` no-ops when `document` is absent and
 * `storageGet` is SSR-safe. Grid colours are restored by the RulersGrid persistence — not here.
 */
export function applySavedCanvasThemeCss(): void {
  const savedTheme = storageGet<ThemeKey>(STORAGE_KEYS.CANVAS_BACKGROUND, DEFAULT_THEME);
  if (savedTheme === 'custom') {
    const savedCustom = storageGet<string>(STORAGE_KEYS.CANVAS_BACKGROUND_CUSTOM, DEFAULT_CUSTOM_COLOR);
    applyCanvasTheme({ cssValue: savedCustom });
    return;
  }
  const preset = PRESET_THEMES.find((th) => th.key === savedTheme) ?? PRESET_THEMES[0];
  applyCanvasTheme(preset);
}
