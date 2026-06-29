'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';
import { storageGet, storageSet, STORAGE_KEYS } from '../../../../utils/storage-utils';
import { EnterpriseColorDialog } from '../../../color/EnterpriseColorDialog';

// ─── Theme definitions ────────────────────────────────────────────────────────

type ThemeKey = 'autocadClassic' | 'autocadDark' | 'solidworks' | 'blender' | 'light' | 'cinema4d' | 'custom';

interface ThemeConfig {
  key: ThemeKey;
  /** CSS value applied to `--canvas-background-dxf` (solid base — CSS var or hex). */
  cssValue: string;
  /** Optional vertical gradient image for `--canvas-background-dxf-image` (2D canvas). */
  gradientImage?: string;
  /** Optional explicit gradient stops for the 3D studio background (`--canvas-gradient-*`). */
  gradientTop?: string;
  gradientBottom?: string;
  /** Optional theme grid colours (`--canvas-grid-major/minor`) — mirrors Cinema 4D scheme. */
  gridMajor?: string;
  gridMinor?: string;
  swatchClass: string;
  textClass: string;
}

const PRESET_THEMES: ThemeConfig[] = [
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

const DEFAULT_THEME: ThemeKey = 'autocadClassic';
const DEFAULT_CUSTOM_COLOR = '#1e293b';

/** Active canvas-theme CSS variables (set on :root by the theme switch). */
const CANVAS_THEME_VARS = {
  base: '--canvas-background-dxf',
  image: '--canvas-background-dxf-image',
  gradientTop: '--canvas-gradient-top',
  gradientBottom: '--canvas-gradient-bottom',
  gridMajor: '--canvas-grid-major',
  gridMinor: '--canvas-grid-minor',
} as const;

function setOrClear(root: CSSStyleDeclaration, name: string, value?: string): void {
  if (value) root.setProperty(name, value);
  else root.removeProperty(name);
}

/**
 * Apply a full canvas theme (Cinema 4D-style scheme): solid base + optional vertical gradient
 * (2D image + 3D stops) + optional grid colours — all in one place so 2D and 3D move together.
 * Solid themes clear the gradient/grid vars (→ flat background, generic grid).
 */
function applyCanvasTheme(
  theme: Pick<ThemeConfig, 'cssValue' | 'gradientImage' | 'gradientTop' | 'gradientBottom' | 'gridMajor' | 'gridMinor'>,
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  root.setProperty(CANVAS_THEME_VARS.base, theme.cssValue);
  root.setProperty(CANVAS_THEME_VARS.image, theme.gradientImage ?? 'none');
  setOrClear(root, CANVAS_THEME_VARS.gradientTop, theme.gradientTop);
  setOrClear(root, CANVAS_THEME_VARS.gradientBottom, theme.gradientBottom);
  setOrClear(root, CANVAS_THEME_VARS.gridMajor, theme.gridMajor);
  setOrClear(root, CANVAS_THEME_VARS.gridMinor, theme.gridMinor);
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface BackgroundCategoryProps {
  className?: string;
}

export const BackgroundCategory: React.FC<BackgroundCategoryProps> = ({ className = '' }) => {
  const { t } = useTranslation(['dxf-viewer-settings']);
  const colors = useSemanticColors();
  const [activeTheme, setActiveTheme] = useState<ThemeKey>(DEFAULT_THEME);
  const [customColor, setCustomColor] = useState<string>(DEFAULT_CUSTOM_COLOR);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  useEffect(() => {
    const savedTheme = storageGet<ThemeKey>(STORAGE_KEYS.CANVAS_BACKGROUND, DEFAULT_THEME);
    const savedCustom = storageGet<string>(STORAGE_KEYS.CANVAS_BACKGROUND_CUSTOM, DEFAULT_CUSTOM_COLOR);
    setActiveTheme(savedTheme);
    setCustomColor(savedCustom);
    if (savedTheme === 'custom') {
      applyCanvasTheme({ cssValue: savedCustom });
    } else {
      const preset = PRESET_THEMES.find(th => th.key === savedTheme) ?? PRESET_THEMES[0];
      applyCanvasTheme(preset);
    }
  }, []);

  const handleSelectPreset = useCallback((theme: ThemeConfig) => {
    setActiveTheme(theme.key);
    applyCanvasTheme(theme);
    storageSet(STORAGE_KEYS.CANVAS_BACKGROUND, theme.key);
  }, []);

  const handleSelectCustom = useCallback(() => {
    setActiveTheme('custom');
    applyCanvasTheme({ cssValue: customColor });
    storageSet(STORAGE_KEYS.CANVAS_BACKGROUND, 'custom');
    setIsPickerOpen(true);
  }, [customColor]);

  const handleCustomColorChange = useCallback((color: string) => {
    setCustomColor(color);
    applyCanvasTheme({ cssValue: color });
  }, []);

  const handleCustomColorCommit = useCallback((color: string) => {
    setCustomColor(color);
    applyCanvasTheme({ cssValue: color });
    storageSet(STORAGE_KEYS.CANVAS_BACKGROUND_CUSTOM, color);
    storageSet(STORAGE_KEYS.CANVAS_BACKGROUND, 'custom');
  }, []);

  return (
    <section className={`flex flex-col ${PANEL_LAYOUT.GAP.MD} p-3 ${className}`}>
      <p className={`text-xs font-medium ${colors.text.muted}`}>
        {t('backgroundCategory.themeLabel')}
      </p>
      <ul className={`grid grid-cols-1 ${PANEL_LAYOUT.GAP.SM}`} role="listbox" aria-label={t('backgroundCategory.themeLabel')}>
        {PRESET_THEMES.map((theme) => {
          const isActive = activeTheme === theme.key;
          return (
            <li key={theme.key} role="option" aria-selected={isActive}>
              <button
                type="button"
                onClick={() => handleSelectPreset(theme)}
                className={[
                  'w-full flex items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                  isActive
                    ? 'ring-2 ring-ring bg-primary/10'
                    : `${colors.bg.secondary} hover:${colors.bg.tertiary}`,
                ].join(' ')}
              >
                <span className={`w-8 h-8 rounded border-2 flex-shrink-0 ${theme.swatchClass}`} />
                <span className={`text-sm font-medium ${colors.text.primary}`}>
                  {t(`backgroundCategory.themes.${theme.key}`)}
                </span>
                {isActive && (
                  <svg className="ml-auto w-4 h-4 text-primary flex-shrink-0" fill="none" viewBox="0 0 16 16">
                    <path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            </li>
          );
        })}

        {/* Custom row — opens centralized EnterpriseColorDialog */}
        <li role="option" aria-selected={activeTheme === 'custom'}>
          <button
            type="button"
            onClick={handleSelectCustom}
            className={[
              'w-full flex items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
              activeTheme === 'custom'
                ? 'ring-2 ring-ring bg-primary/10'
                : `${colors.bg.secondary} hover:${colors.bg.tertiary}`,
            ].join(' ')}
          >
            <span
              className="w-8 h-8 rounded border-2 border-border flex-shrink-0"
              style={{ backgroundColor: customColor }}
            />
            <span className={`text-sm font-medium ${colors.text.primary}`}>
              {t('backgroundCategory.themes.custom')}
            </span>
            {activeTheme === 'custom' && (
              <svg className="ml-auto w-4 h-4 text-primary flex-shrink-0" fill="none" viewBox="0 0 16 16">
                <path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </li>
      </ul>

      <EnterpriseColorDialog
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        title={t('backgroundCategory.customDialogTitle')}
        value={customColor}
        onChange={handleCustomColorChange}
        onChangeEnd={handleCustomColorCommit}
        alpha={false}
      />
    </section>
  );
};

export default BackgroundCategory;
