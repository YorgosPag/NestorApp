import React, { useState } from 'react';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS, CORE_HOVER_TRANSFORMS, HOVER_TEXT_EFFECTS } from '../../../../../ui/effects';
import { useDynamicBackgroundClass, useDynamicBorderClass } from '@/components/ui/utils/dynamic-styles';
import { ENHANCED_STATUS_LABELS as PROPERTY_STATUS_LABELS, ENHANCED_STATUS_COLORS as PROPERTY_STATUS_COLORS } from '@/constants/property-statuses-enterprise';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Palette, Pencil, RotateCcw, Construction, Layers } from 'lucide-react';
// 🏢 ENTERPRISE: Import centralized tabs system (same as Contacts/ΓΕΜΗ/PanelTabs/etc.)
import { TabsOnlyTriggers, type TabDefinition } from '@/components/ui/navigation/TabsComponents';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';

interface LayersSettingsProps {
  // Για μελλοντική επέκταση μπορούμε να προσθέσουμε props
}

export const LayersSettings: React.FC<LayersSettingsProps> = () => {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder, getDirectionalBorder, radius } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('dxf-viewer');
  const [activeTab, setActiveTab] = useState<'outlines' | 'fills'>('outlines');
  const [selectedPreset, setSelectedPreset] = useState<number>(0);

  // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ: Χρησιμοποιούμε τα centralized constants αντί για διάσπαρτα
  const presetColors = [
    { name: t(PROPERTY_STATUS_LABELS['for-sale']), color: PROPERTY_STATUS_COLORS['for-sale'] },
    { name: t(PROPERTY_STATUS_LABELS['for-rent']), color: PROPERTY_STATUS_COLORS['for-rent'] },
    { name: t(PROPERTY_STATUS_LABELS['reserved']), color: PROPERTY_STATUS_COLORS['reserved'] },
    { name: t(PROPERTY_STATUS_LABELS['sold']), color: PROPERTY_STATUS_COLORS['sold'] },
    { name: t(PROPERTY_STATUS_LABELS['landowner']), color: PROPERTY_STATUS_COLORS['landowner'] }
  ];

  // 🎨 ENTERPRISE DYNAMIC STYLING - NO INLINE STYLES (CLAUDE.md compliant)
  // Precompute all dynamic classes for preset colors
  const presetClasses = presetColors.map(preset => ({
    ...preset,
    borderClass: useDynamicBorderClass(preset.color, '2px'),
    bgClass: useDynamicBackgroundClass(preset.color),
    bgWithOpacityClass: useDynamicBackgroundClass(preset.color, 0.5)
  }));

  // ============================================================================
  // TAB CONFIGURATION - 🏢 ENTERPRISE: Using centralized TabDefinition interface
  // ============================================================================

  type LayerTab = 'outlines' | 'fills';

  const layerTabs: TabDefinition[] = [
    {
      id: 'outlines',
      label: t('layersSettings.tabs.outlines'),
      icon: Pencil, // 🏢 ENTERPRISE: Lucide icon
      content: null, // Content rendered separately below
    },
    {
      id: 'fills',
      label: t('layersSettings.tabs.fills'),
      icon: Palette, // 🏢 ENTERPRISE: Lucide icon
      content: null, // Content rendered separately below
    },
  ];

  // 🏢 ENTERPRISE: Handle tab change - convert string to LayerTab
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as LayerTab);
  };

  return (
    <section className={`${colors.bg.primary} ${colors.text.primary}`}>
      {/* Header */}
      <header className={`${getDirectionalBorder('muted', 'bottom')} ${PANEL_LAYOUT.PADDING.BOTTOM_SM} ${PANEL_LAYOUT.MARGIN.BOTTOM_LG}`}>
        <h2 className={`${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${colors.text.primary} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <Layers className={iconSizes.md} />
          <span>{t('layersSettings.title')}</span>
        </h2>
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>
          {t('layersSettings.description')}
        </p>
      </header>

      {/* Layer Preview */}
      <div className={`${PANEL_LAYOUT.MARGIN.BOTTOM_LG} ${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
          <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('layersSettings.preview.title')}</div>
          <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('layersSettings.preview.description')}</div>
        </div>
        <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.muted} ${quick.card} ${getStatusBorder('muted')} flex justify-center`}>
          <div className={`flex ${PANEL_LAYOUT.GAP.XS}`}>
            {presetClasses.map((preset, index) => (
              <div
                key={preset.name}
                className={`
                  border ${quick.card} ${PANEL_LAYOUT.CURSOR.POINTER} ${PANEL_LAYOUT.TRANSITION.TRANSFORM} ${iconSizes.lg}
                  ${CORE_HOVER_TRANSFORMS.SCALE_UP}
                  ${preset.borderClass}
                  ${activeTab === 'fills' ? preset.bgWithOpacityClass : ''}
                `}
                title={preset.name}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 🏢 ENTERPRISE: Tabs Navigation - className moved directly to component (ADR-003) */}
      <TabsOnlyTriggers
        tabs={layerTabs}
        value={activeTab}
        onTabChange={handleTabChange}
        theme="dark"
        alwaysShowLabels={true}
        className={PANEL_LAYOUT.MARGIN.BOTTOM_LG}
      />

      {/* Tab Content */}
      <div className={PANEL_LAYOUT.SPACING.GAP_LG}>
        {activeTab === 'outlines' && (
          <>
            {/* Preset Outline Colors */}
            <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
              <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>{t('layersSettings.outlines.colorsTitle')}</div>
              <div className={`grid ${PANEL_LAYOUT.GRID.COLS_5} ${PANEL_LAYOUT.GAP.SM}`}>
                {presetClasses.map((preset, index) => (
                  <button
                    key={preset.name}
                    onClick={() => setSelectedPreset(index)}
                    className={`${PANEL_LAYOUT.SPACING.SM} ${quick.button} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
                      selectedPreset === index
                        ? `${colors.bg.info} ${getStatusBorder('info')}`
                        : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
                    }`}
                  >
                    <div
                      className={`w-full ${iconSizes.lg} ${quick.card} ${getStatusBorder('subtle')} ${preset.bgClass}`}
                    />
                    <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.primary} ${PANEL_LAYOUT.MARGIN.TOP_XS} ${PANEL_LAYOUT.TEXT_OVERFLOW.TRUNCATE}`}>{preset.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Outline Settings */}
            <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} rounded`}>
              <div className="flex items-center justify-between">
                <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
                  <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('layersSettings.outlines.displayTitle')}</div>
                  <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('layersSettings.outlines.displayDescription')}</div>
                </div>
                <div className={`relative inline-flex ${iconSizes.lg} ${iconSizes.xl3} ${PANEL_LAYOUT.FLEX_SHRINK.NONE} ${PANEL_LAYOUT.CURSOR.POINTER} ${radius.full} border border-transparent ${colors.bg.success}`}>
                  <span className={`${PANEL_LAYOUT.POINTER_EVENTS.NONE} inline-block ${iconSizes.sm} ${radius.full} ${colors.bg.primary} shadow transition ${PANEL_LAYOUT.DURATION['200']} ${PANEL_LAYOUT.EASING.IN_OUT} transform ${PANEL_LAYOUT.TRANSFORM.TOGGLE_ON}`} />
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'fills' && (
          <>
            {/* Preset Fill Colors */}
            <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
              <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>{t('layersSettings.fills.colorsTitle')}</div>
              <div className={`grid ${PANEL_LAYOUT.GRID.COLS_5} ${PANEL_LAYOUT.GAP.SM}`}>
                {presetClasses.map((preset, index) => (
                  <button
                    key={preset.name}
                    onClick={() => setSelectedPreset(index)}
                    className={`${PANEL_LAYOUT.SPACING.SM} ${quick.button} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
                      selectedPreset === index
                        ? `${colors.bg.info} ${getStatusBorder('info')}`
                        : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
                    }`}
                  >
                    <div
                      className={`w-full ${iconSizes.lg} ${quick.card} ${getStatusBorder('subtle')} ${preset.bgClass}`}
                    />
                    <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.primary} ${PANEL_LAYOUT.MARGIN.TOP_XS} ${PANEL_LAYOUT.TEXT_OVERFLOW.TRUNCATE}`}>{preset.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Opacity Control */}
            <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
              <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
                <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('layersSettings.fills.opacityTitle')}</div>
                <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('layersSettings.fills.opacityDescription')}</div>
              </div>
              <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  defaultValue="1.0"
                  className="flex-1"
                />
                <div className={`${iconSizes.xl3} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.muted} ${colors.text.inverted} rounded ${PANEL_LAYOUT.SPACING.COMPACT} text-center`}>
                  100%
                </div>
              </div>
            </div>

            {/* Fill Settings */}
            <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} rounded`}>
              <div className="flex items-center justify-between">
                <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
                  <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('layersSettings.fills.displayTitle')}</div>
                  <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('layersSettings.fills.displayDescription')}</div>
                </div>
                <div className={`relative inline-flex ${iconSizes.lg} ${iconSizes.xl3} ${PANEL_LAYOUT.FLEX_SHRINK.NONE} ${PANEL_LAYOUT.CURSOR.POINTER} ${radius.full} border border-transparent ${colors.bg.success}`}>
                  <span className={`${PANEL_LAYOUT.POINTER_EVENTS.NONE} inline-block ${iconSizes.sm} ${radius.full} ${colors.bg.primary} shadow transition ${PANEL_LAYOUT.DURATION['200']} ${PANEL_LAYOUT.EASING.IN_OUT} transform ${PANEL_LAYOUT.TRANSFORM.TOGGLE_ON}`} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Reset Button */}
        <article className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
          <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
            <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('layersSettings.reset.title')}</div>
            <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('layersSettings.reset.description')}</div>
          </div>
          <button className={`w-full ${PANEL_LAYOUT.BUTTON.PADDING} ${PANEL_LAYOUT.TYPOGRAPHY.XS} flex items-center justify-center ${PANEL_LAYOUT.GAP.SM} ${colors.bg.error} ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER} ${colors.text.inverted} rounded ${PANEL_LAYOUT.TRANSITION.COLORS}`}>
            <RotateCcw className={iconSizes.sm} />
            <span>{t('layersSettings.reset.button')}</span>
          </button>
        </article>

        {/* Coming Soon Features */}
        <aside className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${quick.card} ${getStatusBorder('muted')}`}>
          <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            <Construction className={iconSizes.sm} />
            <span>{t('layersSettings.comingSoon.title')}</span>
          </div>
          <ul className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} list-none ${PANEL_LAYOUT.SPACING.GAP_XS}`}>
            <li>• {t('layersSettings.comingSoon.items.fillColors')}</li>
            <li>• {t('layersSettings.comingSoon.items.lineThickness')}</li>
            <li>• {t('layersSettings.comingSoon.items.lineStyles')}</li>
            <li>• {t('layersSettings.comingSoon.items.customPalettes')}</li>
            <li>• {t('layersSettings.comingSoon.items.importExport')}</li>
          </ul>
        </aside>
      </div>
    </section>
  );
};