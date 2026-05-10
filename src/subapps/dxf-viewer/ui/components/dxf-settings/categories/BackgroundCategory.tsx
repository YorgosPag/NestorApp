'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';
import { storageGet, storageSet, STORAGE_KEYS } from '../../../../utils/storage-utils';

// ─── Theme definitions ────────────────────────────────────────────────────────

type ThemeKey = 'autocadClassic' | 'autocadDark' | 'solidworks' | 'blender' | 'light';

interface ThemeConfig {
  key: ThemeKey;
  cssVar: string;
  swatchClass: string;
  textClass: string;
}

const THEMES: ThemeConfig[] = [
  { key: 'autocadClassic', cssVar: 'var(--canvas-themes-autocad-classic)', swatchClass: 'bg-black border-zinc-700',          textClass: 'text-zinc-300' },
  { key: 'autocadDark',    cssVar: 'var(--canvas-themes-autocad-dark)',    swatchClass: 'bg-[#1a1a1a] border-zinc-600',       textClass: 'text-zinc-300' },
  { key: 'solidworks',     cssVar: 'var(--canvas-themes-solidworks)',      swatchClass: 'bg-[#2d3748] border-slate-500',       textClass: 'text-zinc-300' },
  { key: 'blender',        cssVar: 'var(--canvas-themes-blender)',         swatchClass: 'bg-[#232323] border-zinc-600',        textClass: 'text-zinc-300' },
  { key: 'light',          cssVar: 'var(--canvas-themes-light)',           swatchClass: 'bg-white border-zinc-300',            textClass: 'text-zinc-800' },
];

const DEFAULT_THEME: ThemeKey = 'autocadClassic';

function applyTheme(cssVar: string): void {
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--canvas-background-dxf', cssVar);
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

  useEffect(() => {
    const saved = storageGet<ThemeKey>(STORAGE_KEYS.CANVAS_BACKGROUND, DEFAULT_THEME);
    setActiveTheme(saved);
    const theme = THEMES.find(th => th.key === saved) ?? THEMES[0];
    applyTheme(theme.cssVar);
  }, []);

  const handleSelect = useCallback((theme: ThemeConfig) => {
    setActiveTheme(theme.key);
    applyTheme(theme.cssVar);
    storageSet(STORAGE_KEYS.CANVAS_BACKGROUND, theme.key);
  }, []);

  return (
    <section className={`flex flex-col ${PANEL_LAYOUT.GAP.MD} p-3 ${className}`}>
      <p className={`text-xs font-medium ${colors.text.muted}`}>
        {t('backgroundCategory.themeLabel')}
      </p>
      <ul className={`grid grid-cols-1 ${PANEL_LAYOUT.GAP.SM}`} role="listbox" aria-label={t('backgroundCategory.themeLabel')}>
        {THEMES.map((theme) => {
          const isActive = activeTheme === theme.key;
          return (
            <li key={theme.key} role="option" aria-selected={isActive}>
              <button
                type="button"
                onClick={() => handleSelect(theme)}
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
      </ul>
    </section>
  );
};

export default BackgroundCategory;
