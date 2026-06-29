'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';
import { storageGet, storageSet, STORAGE_KEYS } from '../../../../utils/storage-utils';
import { EnterpriseColorDialog } from '../../../color/EnterpriseColorDialog';
import { resolveCssVarColor } from '../../../../config/color-config';
import { useRulersGridContext } from '../../../../systems/rulers-grid/RulersGridSystem';
// 🏢 ADR-004 SSoT — theme catalogue + CSS apply shared with the startup restore
// (`applySavedCanvasThemeCss`), so the chosen background survives a hard refresh.
import {
  type ThemeKey,
  type ThemeConfig,
  PRESET_THEMES,
  DEFAULT_THEME,
  DEFAULT_CUSTOM_COLOR,
  applyCanvasTheme,
} from '../../../../config/canvas-theme';

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
  const { state: { grid }, updateGridSettings } = useRulersGridContext();

  /**
   * Apply a whole canvas theme as a Cinema 4D-style scheme: the CSS side (solid base + 2D/3D
   * gradient) plus — for themes that define them — the scheme grid colours written straight
   * into the RulersGrid context (resolved to concrete hex for Canvas2D `ctx.strokeStyle`).
   * Themes without grid colours leave the user's grid untouched.
   */
  const applyTheme = useCallback(
    (theme: Pick<ThemeConfig, 'cssValue' | 'gradientImage' | 'gradientTop' | 'gradientBottom' | 'gridMajor' | 'gridMinor'>) => {
      applyCanvasTheme(theme);
      if (theme.gridMajor && theme.gridMinor) {
        updateGridSettings({
          visual: {
            ...grid.visual,
            majorGridColor: resolveCssVarColor(theme.gridMajor),
            minorGridColor: resolveCssVarColor(theme.gridMinor),
          },
        });
      }
    },
    [grid.visual, updateGridSettings],
  );

  useEffect(() => {
    const savedTheme = storageGet<ThemeKey>(STORAGE_KEYS.CANVAS_BACKGROUND, DEFAULT_THEME);
    const savedCustom = storageGet<string>(STORAGE_KEYS.CANVAS_BACKGROUND_CUSTOM, DEFAULT_CUSTOM_COLOR);
    setActiveTheme(savedTheme);
    setCustomColor(savedCustom);
    if (savedTheme === 'custom') {
      applyTheme({ cssValue: savedCustom });
    } else {
      const preset = PRESET_THEMES.find(th => th.key === savedTheme) ?? PRESET_THEMES[0];
      applyTheme(preset);
    }
    // Run once on mount — re-applying on every grid change would fight live grid edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectPreset = useCallback((theme: ThemeConfig) => {
    setActiveTheme(theme.key);
    applyTheme(theme);
    storageSet(STORAGE_KEYS.CANVAS_BACKGROUND, theme.key);
  }, [applyTheme]);

  const handleSelectCustom = useCallback(() => {
    setActiveTheme('custom');
    applyTheme({ cssValue: customColor });
    storageSet(STORAGE_KEYS.CANVAS_BACKGROUND, 'custom');
    setIsPickerOpen(true);
  }, [customColor, applyTheme]);

  const handleCustomColorChange = useCallback((color: string) => {
    setCustomColor(color);
    applyTheme({ cssValue: color });
  }, [applyTheme]);

  const handleCustomColorCommit = useCallback((color: string) => {
    setCustomColor(color);
    applyTheme({ cssValue: color });
    storageSet(STORAGE_KEYS.CANVAS_BACKGROUND_CUSTOM, color);
    storageSet(STORAGE_KEYS.CANVAS_BACKGROUND, 'custom');
  }, [applyTheme]);

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
