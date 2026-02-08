// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import React from 'react';
import { useCursorSettings } from '../../../../../systems/cursor';
import { ColorDialogTrigger } from '../../../../color/EnterpriseColorDialog';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import {
  getCursorPreviewBorderStyles,
  getCursorShapeButtonStyles,
  getCursorColorPreviewStyles,
  getCursorLinePreviewStyles,
  getCursorSizePreviewStyles,
  getCursorDimensionPreviewStyles
} from '../../../../DxfViewerComponents.styles';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n';
// 🏢 ADR-081: Centralized percentage formatting
import { formatPercent } from '../../../../../rendering/entities/shared/distance-label-utils';

export function CursorSettings() {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder, getDirectionalBorder, radius } = useBorderTokens();
  const colors = useSemanticColors();
  // 🌐 i18n
  const { t } = useTranslation('dxf-viewer');
  // Αφαιρείται το tab state - όλες οι ρυθμίσεις θα εμφανίζονται μαζί

  // 🔺 REAL CURSOR SYSTEM INTEGRATION - Αντικατάσταση mock state
  const { settings, updateSettings } = useCursorSettings();

  // Real handlers που συνδέονται με το CursorSystem

  const handleCursorShapeChange = (shape: 'circle' | 'square') => {
    updateSettings({
      cursor: { ...settings.cursor, shape }
    });
  };

  const handleCursorSizeChange = (size: number) => {
    updateSettings({
      cursor: { ...settings.cursor, size }
    });
  };

  const handleCursorColorChange = (color: string) => {
    updateSettings({
      cursor: { ...settings.cursor, color }
    });
  };

  const handleCursorLineStyleChange = (lineStyle: 'solid' | 'dashed' | 'dotted' | 'dash-dot') => {
    updateSettings({
      cursor: { ...settings.cursor, line_style: lineStyle }
    });
  };

  const handleCursorOpacityChange = (opacity: number) => {
    updateSettings({
      cursor: { ...settings.cursor, opacity }
    });
  };

  const handleCursorEnabledChange = (enabled: boolean) => {
    updateSettings({
      cursor: { ...settings.cursor, enabled }
    });
  };

  const handleCursorLineWidthChange = (lineWidth: number) => {
    updateSettings({
      cursor: { ...settings.cursor, line_width: lineWidth }
    });
  };

  return (
    <article className={`${PANEL_LAYOUT.SPACING.GAP_LG} ${PANEL_LAYOUT.MAX_HEIGHT.XL} ${PANEL_LAYOUT.OVERFLOW.Y_AUTO}`}>
      {/* 🏢 ENTERPRISE: Semantic header για section */}
      <header className={`${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary} ${getDirectionalBorder('muted', 'bottom')} ${PANEL_LAYOUT.PADDING.BOTTOM_SM}`}>
        {t('cursorSettings.title')}
      </header>

      {/* Cursor Shape - 🏢 ENTERPRISE: Semantic section αντί nested divs */}
      <section className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${radius.lg} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <h4 className={`${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>{t('cursorSettings.shape.title')}</h4>
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>{t('cursorSettings.shape.description')}</p>
        <div className={`grid ${PANEL_LAYOUT.GRID.COLS_2} ${PANEL_LAYOUT.GAP.SM}`}>
              <button
                onClick={() => handleCursorShapeChange('circle')}
                className={`${PANEL_LAYOUT.SPACING.SM} ${quick.button} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
                  settings.cursor.shape === 'circle'
                    ? `${colors.bg.primary} ${getStatusBorder('info')}`
                    : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
                }`}
              >
                <div
                  className={`${iconSizes.sm} mx-auto ${radius.full} border`}
                  style={getCursorPreviewBorderStyles(settings.cursor.color)}
                ></div>
                <span className={`block ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>{t('cursorSettings.shape.circle')}</span>
              </button>
              <button
                onClick={() => handleCursorShapeChange('square')}
                className={`${PANEL_LAYOUT.SPACING.SM} ${quick.button} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
                  settings.cursor.shape === 'square'
                    ? `${colors.bg.primary} ${getStatusBorder('info')}`
                    : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
                }`}
              >
                <div
                  className={`${iconSizes.sm} mx-auto border`}
                  style={getCursorPreviewBorderStyles(settings.cursor.color)}
                ></div>
                <span className={`block ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>{t('cursorSettings.shape.square')}</span>
              </button>
            </div>
      </section>

      {/* Cursor Color - 🏢 ENTERPRISE: Semantic section */}
      <section className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${radius.lg} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <h4 className={`${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.secondary}`}>{t('cursorSettings.color.title')}</h4>
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>{t('cursorSettings.color.description')}</p>
        <ColorDialogTrigger
              value={settings.cursor.color}
              onChange={handleCursorColorChange}
              label={settings.cursor.color}
              title={t('cursorSettings.colorPicker')}
              alpha={false}
              modes={['hex', 'rgb', 'hsl']}
              palettes={['dxf', 'semantic', 'material']}
              recent={true}
              eyedropper={true}
        />
      </section>

      {/* Cursor Line Style - 🏢 ENTERPRISE: Semantic section */}
      <section className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${radius.lg} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <h4 className={`${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>{t('cursorSettings.lineStyle.title')}</h4>
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>{t('cursorSettings.lineStyle.description')}</p>
        <div className={`grid ${PANEL_LAYOUT.GRID.COLS_2} ${PANEL_LAYOUT.GAP.SM}`}>
              <button
                onClick={() => handleCursorLineStyleChange('solid')}
                className={`${PANEL_LAYOUT.SPACING.SM} ${quick.button} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
                  settings.cursor.line_style === 'solid'
                    ? `${colors.bg.primary} ${getStatusBorder('info')}`
                    : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
                }`}
              >
                <div
                  className="w-full"
                  style={getCursorLinePreviewStyles(settings.cursor.color, 'solid')}
                ></div>
                <span className={`block ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>{t('cursorSettings.lineStyles.solid')}</span>
              </button>
              <button
                onClick={() => handleCursorLineStyleChange('dashed')}
                className={`${PANEL_LAYOUT.SPACING.SM} ${quick.button} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
                  settings.cursor.line_style === 'dashed'
                    ? `${colors.bg.primary} ${getStatusBorder('info')}`
                    : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
                }`}
              >
                <div
                  className="w-full"
                  style={getCursorLinePreviewStyles(settings.cursor.color, 'dashed')}
                ></div>
                <span className={`block ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>{t('cursorSettings.lineStyles.dashed')}</span>
              </button>
            </div>
            <div className={`grid ${PANEL_LAYOUT.GRID.COLS_2} ${PANEL_LAYOUT.GAP.SM} ${PANEL_LAYOUT.MARGIN.TOP_SM}`}>
              <button
                onClick={() => handleCursorLineStyleChange('dotted')}
                className={`${PANEL_LAYOUT.SPACING.SM} ${quick.button} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
                  settings.cursor.line_style === 'dotted'
                    ? `${colors.bg.primary} ${getStatusBorder('info')}`
                    : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
                }`}
              >
                <div
                  className="w-full"
                  style={getCursorLinePreviewStyles(settings.cursor.color, 'dotted')}
                ></div>
                <span className={`block ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>{t('cursorSettings.lineStyles.dotted')}</span>
              </button>
              <button
                onClick={() => handleCursorLineStyleChange('dash-dot')}
                className={`${PANEL_LAYOUT.SPACING.SM} ${quick.button} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
                  settings.cursor.line_style === 'dash-dot'
                    ? `${colors.bg.primary} ${getStatusBorder('info')}`
                    : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
                }`}
              >
                <div
                  className="w-full"
                  style={getCursorLinePreviewStyles(settings.cursor.color, 'dash-dot')}
                ></div>
                <span className={`block ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>{t('cursorSettings.lineStyles.dashDot')}</span>
              </button>
            </div>
      </section>

      {/* Cursor Line Width - 🏢 ENTERPRISE: Semantic section */}
      <section className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${radius.lg} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <h4 className={`${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>{t('cursorSettings.lineWidth.title')}</h4>
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>{t('cursorSettings.lineWidth.description')}</p>
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <input
            type="range"
            min="1"
            max="5"
            step="0.5"
            value={settings.cursor.line_width || 1}
            onChange={(e) => handleCursorLineWidthChange(parseFloat(e.target.value))}
            className="flex-1"
          />
          <div className={`${iconSizes.xs} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.muted} ${colors.text.primary} ${radius.md} ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TEXT_ALIGN.CENTER}`}>{settings.cursor.line_width || 1}px</div>
        </div>
        <div className={`flex ${PANEL_LAYOUT.GAP.XS}`}>
          {[1, 1.5, 2, 3, 4, 5].map(width => (
            <button
              key={width}
              onClick={() => handleCursorLineWidthChange(width)}
              className={`flex-1 ${PANEL_LAYOUT.SPACING.XS} ${radius.md} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
                (settings.cursor.line_width || 1) === width
                  ? `${colors.bg.primary} ${getStatusBorder('info')}`
                  : `${colors.bg.muted} ${getStatusBorder('default')} ${HOVER_BACKGROUND_EFFECTS.PRIMARY}`
              }`}
            >
              <div
                className="w-full mx-auto border"
                style={getCursorSizePreviewStyles(settings.cursor.color, settings.cursor.shape, width)}
              ></div>
              <span className={`block ${PANEL_LAYOUT.MARGIN.TOP_XS} ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}>{width}px</span>
            </button>
          ))}
        </div>
      </section>

      {/* Cursor Size - 🏢 ENTERPRISE: Semantic section */}
      <section className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${radius.lg} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <h4 className={`${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>{t('cursorSettings.size.title')}</h4>
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>{t('cursorSettings.size.description')}</p>
            <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
              <input
                type="range"
                min="3"
                max="50"
                step="1"
                value={settings.cursor.size}
                onChange={(e) => handleCursorSizeChange(parseInt(e.target.value))}
                className="flex-1"
              />
              <div className={`${iconSizes.xs} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.muted} ${colors.text.primary} ${radius.md} ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TEXT_ALIGN.CENTER}`}>{settings.cursor.size}px</div>
            </div>
            <div className={`flex ${PANEL_LAYOUT.GAP.XS}`}>
              {[5, 10, 15, 25, 50].map(size => (
                <button
                  key={size}
                  onClick={() => handleCursorSizeChange(size)}
                  className={`flex-1 ${PANEL_LAYOUT.SPACING.SM} ${quick.button} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
                    settings.cursor.size === size
                      ? `${getStatusBorder('info')} ${colors.bg.primary}`
                      : `${getStatusBorder('default')} ${colors.bg.muted} ${HOVER_BACKGROUND_EFFECTS.PRIMARY}`
                  }`}
                >
                  <div
                    className="mx-auto border"
                    style={getCursorDimensionPreviewStyles(settings.cursor.color, settings.cursor.shape, size)}
                  ></div>
                  <span className={`block ${PANEL_LAYOUT.MARGIN.TOP_XS} ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}>{size}px</span>
                </button>
              ))}
        </div>
      </section>

      {/* Cursor Opacity - 🏢 ENTERPRISE: Semantic section */}
      <section className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${radius.lg} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <h4 className={`${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>{t('cursorSettings.opacity.title')}</h4>
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>{t('cursorSettings.opacity.description')}</p>
            <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={settings.cursor.opacity}
                onChange={(e) => handleCursorOpacityChange(parseFloat(e.target.value))}
                className="flex-1"
              />
              <div className={`${iconSizes.xs} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.muted} ${colors.text.primary} ${radius.md} ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TEXT_ALIGN.CENTER}`}>{formatPercent(settings.cursor.opacity)}</div>
        </div>
      </section>

      {/* Show/Hide Cursor - 🏢 ENTERPRISE: Semantic section */}
      <section className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${radius.lg} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <h4 className={`${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>{t('cursorSettings.display.title')}</h4>
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>{t('cursorSettings.display.description')}</p>
            <div className={`flex ${PANEL_LAYOUT.GAP.SM}`}>
              <button
                onClick={() => handleCursorEnabledChange(true)}
                className={`flex-1 ${PANEL_LAYOUT.SPACING.SM} ${quick.button} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
                  settings.cursor.enabled
                    ? `${colors.bg.primary} ${getStatusBorder('info')}`
                    : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
                }`}
              >
                {t('cursorSettings.display.enabled')}
              </button>
              <button
                onClick={() => handleCursorEnabledChange(false)}
                className={`flex-1 ${PANEL_LAYOUT.SPACING.SM} ${quick.button} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
                  !settings.cursor.enabled
                    ? `${colors.bg.primary} ${getStatusBorder('info')}`
                    : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
                }`}
              >
                {t('cursorSettings.display.disabled')}
              </button>
        </div>
      </section>
    </article>
  );
}
