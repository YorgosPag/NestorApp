// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
// GridSettings.tsx - Grid settings UI (extracted from DxfSettingsPanel)
// STATUS: ACTIVE - Phase 3 Step 3.3a
// PURPOSE: Grid settings UI (Specific Settings → Grid → Grid tab with Major/Minor lines)

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  CROSS-REFERENCES: docs/dxf-settings/MIGRATION_CHECKLIST.md (STEP 3.3a)   ║
 * ║  Parent: categories/GridCategory.tsx (Grid tab)                            ║
 * ║  Uses: useRulersGridContext hook (RulersGridSystem)                        ║
 * ║  Hooks: useTabNavigation (Major/Minor lines sub-tabs)                      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

'use client';

import React from 'react';
import { useRulersGridContext } from '../../../../../systems/rulers-grid/RulersGridSystem';
import { useTabNavigation } from '../../hooks/useTabNavigation';
// 🏢 ENTERPRISE: Import centralized tabs system (same as Contacts/ΓΕΜΗ/PanelTabs/etc.)
import { TabsOnlyTriggers, type TabDefinition } from '@/components/ui/navigation/TabsComponents';
// 🏢 ENTERPRISE: Lucide icons for tabs and style options
import { Equal, Minus, Grid3X3, Circle, Plus } from 'lucide-react';
import { ColorDialogTrigger } from '../../../../color/EnterpriseColorDialog';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized Switch component (Radix)
import { Switch } from '@/components/ui/switch';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n';

export interface GridSettingsProps {
  className?: string;
}

/**
 * GridSettings - Grid visual settings (visibility, size, style, major/minor lines)
 *
 * Purpose:
 * - Configure grid appearance (visibility, size, style)
 * - Major lines settings (color, weight)
 * - Minor lines settings (color, weight)
 * - Live updates to RulersGridSystem via useRulersGridContext
 *
 * Architecture:
 * - Uses useRulersGridContext() hook for grid system integration
 * - Uses useTabNavigation() for Major/Minor sub-tabs
 * - All changes applied immediately (live preview)
 *
 * Extracted from: DxfSettingsPanel.tsx lines 1216-1441
 */
export const GridSettings: React.FC<GridSettingsProps> = ({ className = '' }) => {
  // ============================================================================
  // HOOKS
  // ============================================================================

  const { t } = useTranslation('dxf-viewer');
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // Grid & Rulers context (connected to real system)
  const {
    state: { grid: gridSettings },
    updateGridSettings,
    setGridVisibility
  } = useRulersGridContext();

  // Sub-tabs navigation (Major/Minor lines)
  type GridLinesTab = 'major' | 'minor';
  const { activeTab: activeGridLinesTab, setActiveTab: setActiveGridLinesTab } = useTabNavigation<GridLinesTab>('major');

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleGridVisibilityChange = (enabled: boolean) => {
    setGridVisibility(enabled);
  };

  const handleGridSizeChange = (step: number) => {
    updateGridSettings({
      visual: { ...gridSettings.visual, step }
    });
  };

  const handleGridStyleChange = (style: 'lines' | 'dots' | 'crosses') => {
    updateGridSettings({
      visual: { ...gridSettings.visual, style }
    });
  };

  const handleMajorGridColorChange = (color: string) => {
    updateGridSettings({
      visual: { ...gridSettings.visual, majorGridColor: color }
    });
  };

  const handleMajorGridWeightChange = (weight: number) => {
    updateGridSettings({
      visual: { ...gridSettings.visual, majorGridWeight: weight }
    });
  };

  const handleMinorGridColorChange = (color: string) => {
    updateGridSettings({
      visual: { ...gridSettings.visual, minorGridColor: color }
    });
  };

  const handleMinorGridWeightChange = (weight: number) => {
    updateGridSettings({
      visual: { ...gridSettings.visual, minorGridWeight: weight }
    });
  };

  // ============================================================================
  // TAB CONFIGURATION - 🏢 ENTERPRISE: Using centralized TabDefinition interface
  // ============================================================================

  // 🏢 ENTERPRISE: Grid style options as tabs (Γραμμές/Τελείες/Σταυροί)
  const gridStyleTabs: TabDefinition[] = [
    {
      id: 'lines',
      label: t('gridSettings.style.lines'),
      icon: Minus, // 🏢 ENTERPRISE: Lucide icon for lines
      content: null,
    },
    {
      id: 'dots',
      label: t('gridSettings.style.dots'),
      icon: Circle, // 🏢 ENTERPRISE: Lucide icon for dots
      content: null,
    },
    {
      id: 'crosses',
      label: t('gridSettings.style.crosses'),
      icon: Plus, // 🏢 ENTERPRISE: Lucide icon for crosses
      content: null,
    },
  ];

  // 🏢 ENTERPRISE: Handle grid style change via tabs
  const handleGridStyleTabChange = (tabId: string) => {
    handleGridStyleChange(tabId as 'lines' | 'dots' | 'crosses');
  };

  // 🏢 ENTERPRISE: Dynamic labels based on selected grid style
  const getGridLinesLabels = (style: 'lines' | 'dots' | 'crosses') => {
    switch (style) {
      case 'dots':
        return { major: t('gridSettings.lineTypes.majorDots'), minor: t('gridSettings.lineTypes.minorDots') };
      case 'crosses':
        return { major: t('gridSettings.lineTypes.majorCrosses'), minor: t('gridSettings.lineTypes.minorCrosses') };
      case 'lines':
      default:
        return { major: t('gridSettings.lineTypes.majorLines'), minor: t('gridSettings.lineTypes.minorLines') };
    }
  };

  const gridStyle = gridSettings.visual.style ?? 'lines';
  const gridLinesLabels = getGridLinesLabels(gridStyle);

  const gridLinesTabs: TabDefinition[] = [
    {
      id: 'major',
      label: gridLinesLabels.major,
      icon: Equal, // 🏢 ENTERPRISE: Lucide icon replacing 📏 emoji
      content: null, // Content rendered separately below
    },
    {
      id: 'minor',
      label: gridLinesLabels.minor,
      icon: Grid3X3, // 🏢 ENTERPRISE: Lucide icon replacing 📐 emoji
      content: null, // Content rendered separately below
    },
  ];

  // 🏢 ENTERPRISE: Handle tab change - convert string to GridLinesTab
  const handleGridLinesTabChange = (tabId: string) => {
    setActiveGridLinesTab(tabId as GridLinesTab);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <article className={`${PANEL_LAYOUT.SPACING.GAP_LG} ${className}`}>
      {/* 🏢 ENTERPRISE: Grid Visibility Toggle - Using centralized Switch component */}
      <section className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${quick.card} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <div className="flex items-center justify-between">
          <div>
            <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary}`}>{t('gridSettings.visibility.title')}</h4>
            <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>{t('gridSettings.visibility.description')}</p>
          </div>
          <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
              {gridSettings.visual.enabled ? t('gridSettings.visibility.enabled') : t('gridSettings.visibility.disabled')}
            </span>
            <Switch
              checked={gridSettings.visual.enabled}
              onCheckedChange={handleGridVisibilityChange}
              variant="status"
            />
          </div>
        </div>
      </section>

      {/* Grid Size - 🏢 ENTERPRISE: Semantic section */}
      <section className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${quick.card} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary}`}>{t('gridSettings.size.title')}</h4>
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>{t('gridSettings.size.description')}</p>
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <input
            type="range"
            min="0.5"
            max="50"
            step="0.5"
            value={gridSettings.visual.step}
            onChange={(e) => handleGridSizeChange(parseFloat(e.target.value))}
            className="flex-1"
          />
          <div className={`${PANEL_LAYOUT.WIDTH.VALUE_DISPLAY} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.muted} ${colors.text.primary} ${quick.button} ${PANEL_LAYOUT.SPACING.XS} ${PANEL_LAYOUT.TEXT_ALIGN.CENTER}`}>
            {gridSettings.visual.step}
          </div>
        </div>
      </section>

      {/* 🏢 ENTERPRISE: Grid Style Selector - Using centralized TabsOnlyTriggers */}
      <section className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${quick.card} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary}`}>{t('gridSettings.style.title')}</h4>
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>{t('gridSettings.style.description')}</p>
        <TabsOnlyTriggers
          tabs={gridStyleTabs}
          value={gridSettings.visual.style}
          onTabChange={handleGridStyleTabChange}
          theme="dark"
          alwaysShowLabels={true}
        />
      </section>

      {/* 🏢 ENTERPRISE: Grid Lines Sub-tabs - className moved directly to component (ADR-003) */}
      <nav className={`${quick.separatorH} ${PANEL_LAYOUT.PADDING.TOP_LG}`}>
        <TabsOnlyTriggers
          tabs={gridLinesTabs}
          value={activeGridLinesTab}
          onTabChange={handleGridLinesTabChange}
          theme="dark"
          alwaysShowLabels={true}
          className={PANEL_LAYOUT.MARGIN.BOTTOM_LG}
        />

        {/* Major Lines Tab Content */}
        {activeGridLinesTab === 'major' ? (
          <div className={PANEL_LAYOUT.SPACING.GAP_LG}>
            {/* Major Grid Color */}
            <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${quick.card} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>{t('gridSettings.color.label', { type: gridLinesLabels.major })}</label>
              <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>{t('gridSettings.color.description', { type: gridLinesLabels.major.toLowerCase() })}</div>
              <ColorDialogTrigger
                value={gridSettings.visual.majorGridColor}
                onChange={handleMajorGridColorChange}
                label={gridSettings.visual.majorGridColor}
                title={t('gridSettings.color.selectTitle', { type: gridLinesLabels.major })}
                alpha={false}
                modes={['hex', 'rgb', 'hsl']}
                palettes={['dxf', 'semantic', 'material']}
                recent={true}
                eyedropper={true}
              />
            </div>

            {/* Major Grid Line Weight */}
            <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${quick.card} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
              <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
                <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('gridSettings.weight.label', { type: gridLinesLabels.major })}</div>
                <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('gridSettings.weight.description', { type: gridLinesLabels.major.toLowerCase() })}</div>
              </div>
              <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                <input
                  type="range"
                  min="0.5"
                  max="5"
                  step="0.5"
                  value={gridSettings.visual.majorGridWeight}
                  onChange={(e) => handleMajorGridWeightChange(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <div className={`${PANEL_LAYOUT.WIDTH.VALUE_DISPLAY} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.muted} ${colors.text.primary} ${quick.button} ${PANEL_LAYOUT.SPACING.XS} ${PANEL_LAYOUT.TEXT_ALIGN.CENTER}`}>
                  {gridSettings.visual.majorGridWeight}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Minor Lines Tab Content */
          <div className={PANEL_LAYOUT.SPACING.GAP_LG}>
            {/* Minor Grid Color */}
            <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${quick.card} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>{t('gridSettings.color.label', { type: gridLinesLabels.minor })}</label>
              <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>{t('gridSettings.color.description', { type: gridLinesLabels.minor.toLowerCase() })}</div>
              <ColorDialogTrigger
                value={gridSettings.visual.minorGridColor}
                onChange={handleMinorGridColorChange}
                label={gridSettings.visual.minorGridColor}
                title={t('gridSettings.color.selectTitle', { type: gridLinesLabels.minor })}
                alpha={false}
                modes={['hex', 'rgb', 'hsl']}
                palettes={['dxf', 'semantic', 'material']}
                recent={true}
                eyedropper={true}
              />
            </div>

            {/* Minor Grid Line Weight */}
            <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${quick.card} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
              <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
                <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('gridSettings.weight.label', { type: gridLinesLabels.minor })}</div>
                <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('gridSettings.weight.description', { type: gridLinesLabels.minor.toLowerCase() })}</div>
              </div>
              <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={gridSettings.visual.minorGridWeight}
                  onChange={(e) => handleMinorGridWeightChange(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <div className={`${PANEL_LAYOUT.WIDTH.VALUE_DISPLAY} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.muted} ${colors.text.primary} ${quick.button} ${PANEL_LAYOUT.SPACING.XS} ${PANEL_LAYOUT.TEXT_ALIGN.CENTER}`}>
                  {gridSettings.visual.minorGridWeight}
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>
    </article>
  );
};

export default GridSettings;

/**
 * MIGRATION NOTES: Extracted from DxfSettingsPanel.tsx lines 1216-1441
 * Original: Inline UI in 'grid' tab of grid category (226 lines)
 *
 * Changes:
 * - ✅ Extracted all grid UI to standalone component
 * - ✅ Integrated useRulersGridContext hook
 * - ✅ Added useTabNavigation for Major/Minor sub-tabs
 * - ✅ Replaced inline tab UI with TabNavigation component
 * - ✅ Live updates to grid system
 * - ✅ No breaking changes to existing functionality
 *
 * Benefits:
 * - ✅ Single Responsibility (GridSettings = Grid UI only)
 * - ✅ Reusable component
 * - ✅ Testable in isolation
 * - ✅ Lazy loadable (performance)
 * - ✅ Cleaner parent component (GridCategory)
 */

