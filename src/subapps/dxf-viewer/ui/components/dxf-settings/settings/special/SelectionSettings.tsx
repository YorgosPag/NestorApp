import React, { useState } from 'react';
import { useCursorSettings } from '../../../../../systems/cursor';
import { ColorDialogTrigger } from '../../../../color/EnterpriseColorDialog';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { UI_COLORS } from '../../../../../config/color-config';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';
import { RotateCcw, Square, SquareDashed } from 'lucide-react';
// 🏢 ENTERPRISE: Import centralized tabs system (same as Contacts/ΓΕΜΗ/PanelTabs/DxfSettingsPanel)
import { TabsOnlyTriggers, type TabDefinition } from '@/components/ui/navigation/TabsComponents';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n';
// 🏢 ADR-081: Centralized percentage formatting
import { formatPercent } from '../../../../../rendering/entities/shared/distance-label-utils';

export function SelectionSettings() {
  const [activeSelectionTab, setActiveSelectionTab] = useState<'window' | 'crossing'>('window');

  // 🔺 REAL CURSOR SYSTEM INTEGRATION - Αντικατάσταση mock state με πραγματικές ρυθμίσεις
  const { settings, updateSettings } = useCursorSettings();
  const { getStatusBorder, getElementBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();
  // 🌐 i18n
  const { t } = useTranslation('dxf-viewer');

  // 🏢 ENTERPRISE: Type-safe selection field value type
  type SelectionFieldValue = string | number | 'solid' | 'dashed' | 'dotted' | 'dash-dot';

  // Real handlers που συνδέονται με το CursorSystem
  const handleWindowSelectionChange = (field: string, value: SelectionFieldValue) => {
    updateSettings({
      selection: {
        ...settings.selection,
        window: { ...settings.selection.window, [field]: value }
      }
    });
  };

  const handleCrossingSelectionChange = (field: string, value: SelectionFieldValue) => {
    updateSettings({
      selection: {
        ...settings.selection,
        crossing: { ...settings.selection.crossing, [field]: value }
      }
    });
  };

  const handleResetSelectionSettings = () => {
    updateSettings({
      selection: {
        window: {
          fillColor: UI_COLORS.GRID_BLUE,
          fillOpacity: 0.2,
          borderColor: UI_COLORS.GRID_BLUE,
          borderOpacity: 1.0,
          borderStyle: 'solid' as const,
          borderWidth: 2
        },
        crossing: {
          fillColor: UI_COLORS.DRAWING_PREVIEW,
          fillOpacity: 0.2,
          borderColor: UI_COLORS.DRAWING_PREVIEW,
          borderOpacity: 1.0,
          borderStyle: 'dashed' as const,
          borderWidth: 2
        }
      }
    });
  };

  // 🏢 ENTERPRISE: Selection tab type
  type SelectionTab = 'window' | 'crossing';

  // 🏢 ENTERPRISE: Tabs definition using centralized TabDefinition interface
  const selectionTabs: TabDefinition[] = [
    {
      id: 'window',
      label: t('selectionSettings.tabs.window'),
      icon: Square,
      content: null, // Content rendered separately below
    },
    {
      id: 'crossing',
      label: t('selectionSettings.tabs.crossing'),
      icon: SquareDashed,
      content: null, // Content rendered separately below
    },
  ];

  // 🏢 ENTERPRISE: Handle tab change - convert string to SelectionTab
  const handleTabChange = (tabId: string) => {
    setActiveSelectionTab(tabId as SelectionTab);
  };

  return (
    <div className={`${colors.bg.primary} ${colors.text.primary}`}>
      {/* 🏢 ENTERPRISE: Selection Tabs - className moved directly to component (ADR-003) */}
      <TabsOnlyTriggers
        tabs={selectionTabs}
        value={activeSelectionTab}
        onTabChange={handleTabChange}
        theme="dark"
        alwaysShowLabels={true}
        className={PANEL_LAYOUT.MARGIN.BOTTOM_LG}
      />

      {/* TEMPORARY DEBUG BUTTON */}
      {/* ✅ ENTERPRISE: Κεντρικοποιημένα colors και Lucide icon */}
      <div className={`${PANEL_LAYOUT.MARGIN.BOTTOM_LG} ${PANEL_LAYOUT.SPACING.MD} ${colors.bg.secondary} ${getStatusBorder('warning')} ${PANEL_LAYOUT.ROUNDED.DEFAULT}`}>
        <button
          onClick={handleResetSelectionSettings}
          className={`w-full ${PANEL_LAYOUT.BUTTON.PADDING} ${PANEL_LAYOUT.TYPOGRAPHY.XS} flex items-center justify-center ${PANEL_LAYOUT.GAP.SM} ${colors.bg.card} ${colors.text.primary} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${getStatusBorder('default')} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
        >
          <RotateCcw className={PANEL_LAYOUT.ICON.REGULAR} />
          <span>{t('selectionSettings.resetButton')}</span>
        </button>
        <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_SM}`}>
          {t('selectionSettings.resetDescription')}
        </div>
      </div>

      {/* Tab Content */}
      {activeSelectionTab === 'window' ? (
        <div className={PANEL_LAYOUT.SPACING.GAP_LG}>
          {/* 🏢 ENTERPRISE: Icon color using semantic tokens */}
          <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            <Square className={`${PANEL_LAYOUT.ICON.REGULAR} ${colors.text.info}`} />
            <span>{t('selectionSettings.window.title')}</span>
          </h4>
          <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.BOTTOM_LG}`}>
            {t('selectionSettings.window.description')}
          </div>

          {/* Window Fill Color */}
          <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
            <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>{t('selectionSettings.window.fillColorLabel')}</label>
            <ColorDialogTrigger
              value={settings.selection.window.fillColor}
              onChange={(color) => handleWindowSelectionChange('fillColor', color)}
              label={settings.selection.window.fillColor}
              title={t('selectionSettings.window.fillColor')}
              alpha={false}
              modes={['hex', 'rgb', 'hsl']}
              palettes={['dxf', 'semantic', 'material']}
              recent={true}
              eyedropper={true}
            />
          </div>

          {/* Window Fill Opacity */}
          <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
            <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
              <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('selectionSettings.common.fillOpacity')}</div>
              <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('selectionSettings.common.fillOpacityDesc')}</div>
            </div>
            <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.selection.window.fillOpacity}
                onChange={(e) => handleWindowSelectionChange('fillOpacity', parseFloat(e.target.value))}
                className="flex-1"
              />
              <div className={`${PANEL_LAYOUT.WIDTH.VALUE_DISPLAY} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.muted} ${colors.text.inverted} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TEXT_ALIGN.CENTER}`}>
                {formatPercent(settings.selection.window.fillOpacity)}
              </div>
            </div>
          </div>

          {/* Window Border Color */}
          <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
            <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>{t('selectionSettings.window.borderColorLabel')}</label>
            <ColorDialogTrigger
              value={settings.selection.window.borderColor}
              onChange={(color) => handleWindowSelectionChange('borderColor', color)}
              label={settings.selection.window.borderColor}
              title={t('selectionSettings.window.borderColor')}
              alpha={false}
              modes={['hex', 'rgb', 'hsl']}
              palettes={['dxf', 'semantic', 'material']}
              recent={true}
              eyedropper={true}
            />
          </div>

          {/* Window Border Opacity */}
          <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
            <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
              <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('selectionSettings.common.borderOpacity')}</div>
              <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('selectionSettings.common.borderOpacityDesc')}</div>
            </div>
            <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.selection.window.borderOpacity}
                onChange={(e) => handleWindowSelectionChange('borderOpacity', parseFloat(e.target.value))}
                className="flex-1"
              />
              <div className={`${PANEL_LAYOUT.WIDTH.VALUE_DISPLAY} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.muted} ${colors.text.inverted} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TEXT_ALIGN.CENTER}`}>
                {formatPercent(settings.selection.window.borderOpacity)}
              </div>
            </div>
          </div>

          {/* Window Border Width */}
          <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
            <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
              <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('selectionSettings.common.borderWidth')}</div>
              <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('selectionSettings.common.borderWidthDesc')}</div>
            </div>
            <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={settings.selection.window.borderWidth}
                onChange={(e) => handleWindowSelectionChange('borderWidth', parseInt(e.target.value))}
                className="flex-1"
              />
              <div className={`${PANEL_LAYOUT.WIDTH.VALUE_DISPLAY} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.muted} ${colors.text.inverted} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TEXT_ALIGN.CENTER}`}>
                {settings.selection.window.borderWidth}px
              </div>
            </div>
          </div>

          {/* Window Border Style */}
          <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
            <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
              <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('selectionSettings.common.borderStyle')}</div>
              <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('selectionSettings.common.borderStyleDesc')}</div>
            </div>
            <div className={`grid ${PANEL_LAYOUT.GRID.COLS_2} ${PANEL_LAYOUT.GAP.SM}`}>
              {(['solid', 'dashed', 'dotted', 'dash-dot'] as const).map((style) => {
                const isSelected = settings.selection.window.borderStyle === style;
                const styleLabels = {
                  solid: t('selectionSettings.borderStyles.solid'),
                  dashed: t('selectionSettings.borderStyles.dashed'),
                  dotted: t('selectionSettings.borderStyles.dotted'),
                  'dash-dot': t('selectionSettings.borderStyles.dashDot')
                };

                const getLinePreview = (style: string) => {
                  const color = settings.selection.window.borderColor;
                  switch (style) {
                    case 'dashed':
                      return `repeating-linear-gradient(to right, ${color} 0, ${color} 4px, transparent 4px, transparent 8px)`;
                    case 'dotted':
                      return `repeating-linear-gradient(to right, ${color} 0, ${color} 2px, transparent 2px, transparent 4px)`;
                    case 'dash-dot':
                      return `repeating-linear-gradient(to right, ${color} 0, ${color} 6px, transparent 6px, transparent 8px, ${color} 8px, ${color} 10px, transparent 10px, transparent 12px)`;
                    default:
                      return color;
                  }
                };

                return (
                  <button
                    key={style}
                    onClick={() => handleWindowSelectionChange('borderStyle', style)}
                    className={`${PANEL_LAYOUT.SPACING.SM} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
                      isSelected
                        ? `${colors.bg.primary} ${getStatusBorder('info')}`
                        : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getElementBorder('button', 'default')}`
                    }`}
                  >
                    <div
                      className={`${PANEL_LAYOUT.WIDTH.FULL} ${PANEL_LAYOUT.MARGIN.BOTTOM_XS} ${PANEL_LAYOUT.HEIGHT.DIVIDER}`}
                      style={{ background: getLinePreview(style) }}
                    />
                    <span className={`block ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}>{styleLabels[style]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className={PANEL_LAYOUT.SPACING.GAP_LG}>
          {/* 🏢 ENTERPRISE: Icon color using semantic tokens */}
          <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            <SquareDashed className={`${PANEL_LAYOUT.ICON.REGULAR} ${colors.text.success}`} />
            <span>{t('selectionSettings.crossing.title')}</span>
          </h4>
          <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.BOTTOM_LG}`}>
            {t('selectionSettings.crossing.description')}
          </div>

          {/* Crossing Fill Color */}
          <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
            <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>{t('selectionSettings.crossing.fillColorLabel')}</label>
            <ColorDialogTrigger
              value={settings.selection.crossing.fillColor}
              onChange={(color) => handleCrossingSelectionChange('fillColor', color)}
              label={settings.selection.crossing.fillColor}
              title={t('selectionSettings.crossing.fillColor')}
              alpha={false}
              modes={['hex', 'rgb', 'hsl']}
              palettes={['dxf', 'semantic', 'material']}
              recent={true}
              eyedropper={true}
            />
          </div>

          {/* Crossing Fill Opacity */}
          <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
            <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
              <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('selectionSettings.common.fillOpacity')}</div>
              <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('selectionSettings.common.fillOpacityDesc')}</div>
            </div>
            <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.selection.crossing.fillOpacity}
                onChange={(e) => handleCrossingSelectionChange('fillOpacity', parseFloat(e.target.value))}
                className="flex-1"
              />
              <div className={`${PANEL_LAYOUT.WIDTH.VALUE_DISPLAY} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.muted} ${colors.text.inverted} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TEXT_ALIGN.CENTER}`}>
                {formatPercent(settings.selection.crossing.fillOpacity)}
              </div>
            </div>
          </div>

          {/* Crossing Border Color */}
          <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
            <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>{t('selectionSettings.crossing.borderColorLabel')}</label>
            <ColorDialogTrigger
              value={settings.selection.crossing.borderColor}
              onChange={(color) => handleCrossingSelectionChange('borderColor', color)}
              label={settings.selection.crossing.borderColor}
              title={t('selectionSettings.crossing.borderColor')}
              alpha={false}
              modes={['hex', 'rgb', 'hsl']}
              palettes={['dxf', 'semantic', 'material']}
              recent={true}
              eyedropper={true}
            />
          </div>

          {/* Crossing Border Opacity */}
          <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
            <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
              <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('selectionSettings.common.borderOpacity')}</div>
              <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('selectionSettings.common.borderOpacityDesc')}</div>
            </div>
            <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.selection.crossing.borderOpacity}
                onChange={(e) => handleCrossingSelectionChange('borderOpacity', parseFloat(e.target.value))}
                className="flex-1"
              />
              <div className={`${PANEL_LAYOUT.WIDTH.VALUE_DISPLAY} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.muted} ${colors.text.inverted} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TEXT_ALIGN.CENTER}`}>
                {formatPercent(settings.selection.crossing.borderOpacity)}
              </div>
            </div>
          </div>

          {/* Crossing Border Width */}
          <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
            <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
              <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('selectionSettings.common.borderWidth')}</div>
              <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('selectionSettings.common.borderWidthDesc')}</div>
            </div>
            <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={settings.selection.crossing.borderWidth}
                onChange={(e) => handleCrossingSelectionChange('borderWidth', parseInt(e.target.value))}
                className="flex-1"
              />
              <div className={`${PANEL_LAYOUT.WIDTH.VALUE_DISPLAY} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.muted} ${colors.text.inverted} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TEXT_ALIGN.CENTER}`}>
                {settings.selection.crossing.borderWidth}px
              </div>
            </div>
          </div>

          {/* Crossing Border Style */}
          <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
            <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
              <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('selectionSettings.common.borderStyle')}</div>
              <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('selectionSettings.common.borderStyleDesc')}</div>
            </div>
            <div className={`grid ${PANEL_LAYOUT.GRID.COLS_2} ${PANEL_LAYOUT.GAP.SM}`}>
              {(['solid', 'dashed', 'dotted', 'dash-dot'] as const).map((style) => {
                const isSelected = settings.selection.crossing.borderStyle === style;
                const styleLabels = {
                  solid: t('selectionSettings.borderStyles.solid'),
                  dashed: t('selectionSettings.borderStyles.dashed'),
                  dotted: t('selectionSettings.borderStyles.dotted'),
                  'dash-dot': t('selectionSettings.borderStyles.dashDot')
                };

                const getLinePreview = (style: string) => {
                  const color = settings.selection.crossing.borderColor;
                  switch (style) {
                    case 'dashed':
                      return `repeating-linear-gradient(to right, ${color} 0, ${color} 4px, transparent 4px, transparent 8px)`;
                    case 'dotted':
                      return `repeating-linear-gradient(to right, ${color} 0, ${color} 2px, transparent 2px, transparent 4px)`;
                    case 'dash-dot':
                      return `repeating-linear-gradient(to right, ${color} 0, ${color} 6px, transparent 6px, transparent 8px, ${color} 8px, ${color} 10px, transparent 10px, transparent 12px)`;
                    default:
                      return color;
                  }
                };

                return (
                  <button
                    key={style}
                    onClick={() => handleCrossingSelectionChange('borderStyle', style)}
                    className={`${PANEL_LAYOUT.SPACING.SM} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
                      isSelected
                        ? `${colors.bg.primary} ${getStatusBorder('info')}`
                        : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getElementBorder('button', 'default')}`
                    }`}
                  >
                    <div
                      className={`${PANEL_LAYOUT.WIDTH.FULL} ${PANEL_LAYOUT.MARGIN.BOTTOM_XS} ${PANEL_LAYOUT.HEIGHT.DIVIDER}`}
                      style={{ background: getLinePreview(style) }}
                    />
                    <span className={`block ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}>{styleLabels[style]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
