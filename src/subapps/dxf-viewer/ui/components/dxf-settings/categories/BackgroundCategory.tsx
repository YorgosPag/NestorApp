'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';
import { storageGet, storageSet, STORAGE_KEYS } from '../../../../utils/storage-utils';
import { EnterpriseColorDialog } from '../../../color/EnterpriseColorDialog';

// ─── Theme definitions ────────────────────────────────────────────────────────

type ThemeKey = 'autocadClassic' | 'autocadDark' | 'solidworks' | 'blender' | 'light' | 'custom';

interface ThemeConfig {
  key: ThemeKey;
  /** CSS value applied to `--canvas-background-dxf` (CSS var or hex). */
  cssValue: string;
  swatchClass: string;
  textClass: string;
}

const PRESET_THEMES: ThemeConfig[] = [
  { key: 'autocadClassic', cssValue: 'var(--canvas-themes-autocad-classic)', swatchClass: 'bg-black border-zinc-700',          textClass: 'text-zinc-300' },
  { key: 'autocadDark',    cssValue: 'var(--canvas-themes-autocad-dark)',    swatchClass: 'bg-[#1a1a1a] border-zinc-600',       textClass: 'text-zinc-300' },
  { key: 'solidworks',     cssValue: 'var(--canvas-themes-solidworks)',      swatchClass: 'bg-[#2d3748] border-slate-500',       textClass: 'text-zinc-300' },
  { key: 'blender',        cssValue: 'var(--canvas-themes-blender)',         swatchClass: 'bg-[#232323] border-zinc-600',        textClass: 'text-zinc-300' },
  { key: 'light',          cssValue: 'var(--canvas-themes-light)',           swatchClass: 'bg-white border-zinc-300',            textClass: 'text-zinc-800' },
];

const DEFAULT_THEME: ThemeKey = 'autocadClassic';
const DEFAULT_CUSTOM_COLOR = '#1e293b';

function applyBackground(cssValue: string): void {
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--canvas-background-dxf', cssValue);
  }
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
      applyBackground(savedCustom);
    } else {
      const preset = PRESET_THEMES.find(th => th.key === savedTheme) ?? PRESET_THEMES[0];
      applyBackground(preset.cssValue);
    }
  }, []);

  const handleSelectPreset = useCallback((theme: ThemeConfig) => {
    setActiveTheme(theme.key);
    applyBackground(theme.cssValue);
    storageSet(STORAGE_KEYS.CANVAS_BACKGROUND, theme.key);
  }, []);

  const handleSelectCustom = useCallback(() => {
    setActiveTheme('custom');
    applyBackground(customColor);
    storageSet(STORAGE_KEYS.CANVAS_BACKGROUND, 'custom');
    setIsPickerOpen(true);
  }, [customColor]);

  const handleCustomColorChange = useCallback((color: string) => {
    setCustomColor(color);
    applyBackground(color);
  }, []);

  const handleCustomColorCommit = useCallback((color: string) => {
    setCustomColor(color);
    applyBackground(color);
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
                    ? 'ring-2 ring-blue-500 bg-blue-500/10'
                    : `${colors.bg.secondary} hover:${colors.bg.tertiary}`,
                ].join(' ')}
              >
                <span className={`w-8 h-8 rounded border-2 flex-shrink-0 ${theme.swatchClass}`} />
                <span className={`text-sm font-medium ${colors.text.primary}`}>
                  {t(`backgroundCategory.themes.${theme.key}`)}
                </span>
                {isActive && (
                  <svg className="ml-auto w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 16 16">
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
                ? 'ring-2 ring-blue-500 bg-blue-500/10'
                : `${colors.bg.secondary} hover:${colors.bg.tertiary}`,
            ].join(' ')}
          >
            <span
              className="w-8 h-8 rounded border-2 border-zinc-600 flex-shrink-0"
              style={{ backgroundColor: customColor }}
            />
            <span className={`text-sm font-medium ${colors.text.primary}`}>
              {t('backgroundCategory.themes.custom')}
            </span>
            {activeTheme === 'custom' && (
              <svg className="ml-auto w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 16 16">
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
