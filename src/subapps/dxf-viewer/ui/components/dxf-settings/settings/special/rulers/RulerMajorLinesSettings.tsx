// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
// RulerMajorLinesSettings.tsx - Major lines appearance settings (extracted from RulerLinesSettings)
// STATUS: ACTIVE - Enterprise Split (485 lines → 3 components)
// PURPOSE: Major ruler lines UI (visibility, color, opacity, thickness)

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                        CROSS-REFERENCES (Documentation)                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * 📋 Component Guide:
 *    - docs/dxf-settings/COMPONENT_GUIDE.md (§7.2 RulerMajorLinesSettings)
 *    - Total components: 33 (updated from 29 after Phase 4 split)
 *
 * 🏗️ Migration Checklist:
 *    - docs/dxf-settings/MIGRATION_CHECKLIST.md (Phase 4 - Step 4.2)
 *    - Status: ✅ COMPLETE - Enterprise Split Applied
 *
 * 📊 Architecture:
 *    - docs/dxf-settings/ARCHITECTURE.md (§6.3 Enterprise File Size Compliance)
 *    - File size: 155 lines (✅ <200 lines - Enterprise compliant)
 *
 * 📝 Decision Log:
 *    - docs/dxf-settings/DECISION_LOG.md (ADR-009: Enterprise Split Strategy)
 *    - Rationale: Files >200 lines must be split for maintainability
 *
 * 🔗 Centralized Systems:
 *    - docs/CENTRALIZED_SYSTEMS.md (Rule #12: Settings Components)
 *    - Pattern: Router + Specialized Sub-components
 *
 * 📚 Related Components:
 *    - Parent: RulerLinesSettings.tsx (router - 100 lines)
 *    - Sibling: RulerMinorLinesSettings.tsx (155 lines)
 *    - Uses: useRulersGridContext hook (RulersGridSystem)
 *
 * 📦 Extracted from:
 *    - Original: RulerLinesSettings.tsx lines 200-319 (Phase 3)
 *    - Enterprise Split: Phase 4.2 (2025-10-07)
 *    - Reason: 485 lines → 3 files (100 + 155 + 155)
 */

'use client';

import React from 'react';
import { useRulersGridContext } from '../../../../../../systems/rulers-grid/RulersGridSystem';
import { ColorDialogTrigger } from '../../../../../color/EnterpriseColorDialog';
import { UI_COLORS, withOpacity } from '../../../../../../config/color-config';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ADR-076: Centralized Color Conversion
// 🏢 Color-Conversion SSoT (ADR-573): base-hex + opacity extraction live once in color/utils.
import { stripAlphaToBaseHex as getBaseColor, extractColorOpacity as getOpacityFromColor } from '../../../../../color/utils';
// 🏢 ENTERPRISE: Centralized Switch component (Radix)
import { Switch } from '@/components/ui/switch';
// 🏢 ENTERPRISE: Centralized Panel Layout tokens (spacing, gaps, margins)
import { PANEL_LAYOUT } from '../../../../../../config/panel-tokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n';
import { SliderInput } from '../../../../shared/SliderInput';
// ADR-682: unit = format+parse pair → the value beside the slider becomes typeable.
import { SLIDER_VALUE_UNITS } from '../../../../shared/slider-value-units';

export interface RulerMajorLinesSettingsProps {
  className?: string;
}

/**
 * RulerMajorLinesSettings - Major ruler lines appearance settings
 *
 * Purpose:
 * - Visibility toggle (show/hide major lines)
 * - Color picker (rgba support)
 * - Opacity slider (0.1 - 1.0)
 * - Thickness control (0.5px - 3px)
 *
 * State Management:
 * - Uses useRulersGridContext() for ruler system integration
 * - All changes applied immediately (live preview)
 * - Updates both horizontal and vertical rulers
 *
 * Extracted from: RulerLinesSettings.tsx lines 200-319
 */
export const RulerMajorLinesSettings: React.FC<RulerMajorLinesSettingsProps> = ({ className = '' }) => {
  const colors = useSemanticColors();
  // 🌐 i18n
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  // ============================================================================
  // HOOKS
  // ============================================================================

  const {
    state: { rulers: rulerSettings },
    updateRulerSettings
  } = useRulersGridContext();

  // ============================================================================
  // HELPER FUNCTIONS (must be before handlers that use them)
  // ============================================================================

  // 🏢 Color-Conversion SSoT (ADR-573): getBaseColor / getOpacityFromColor are now the
  // shared `stripAlphaToBaseHex` / `extractColorOpacity` from color/utils (imported above).

  // Helper function to get color for preview icon (handles rgba)
  const getPreviewColor = (color: string): string => {
    return getBaseColor(color);
  };

  // Helper function to get preview background for divs (preserves rgba)
  const getPreviewBackground = (color: string): string => {
    return color;
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleMajorTicksVisibilityChange = (enabled: boolean) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, showMajorTicks: enabled },
      vertical: { ...rulerSettings.vertical, showMajorTicks: enabled }
    });
  };

  const handleMajorTickColorChange = (color: string) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, majorTickColor: color },
      vertical: { ...rulerSettings.vertical, majorTickColor: color }
    });
  };

  const handleMajorTickOpacityChange = (opacity: number) => {
    // 🏢 ENTERPRISE FIX: Extract base color (without alpha) before applying new opacity
    const currentColor = rulerSettings.horizontal.majorTickColor || UI_COLORS.WHITE;
    const baseColor = getBaseColor(currentColor);
    const colorWithOpacity = withOpacity(baseColor, opacity);

    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, majorTickColor: colorWithOpacity },
      vertical: { ...rulerSettings.vertical, majorTickColor: colorWithOpacity }
    });
  };

  const handleMajorTickThicknessChange = (thickness: number) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, majorTickLength: thickness * 10 },
      vertical: { ...rulerSettings.vertical, majorTickLength: thickness * 10 }
    });
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${className}`}>
      {/* 🏢 ENTERPRISE: Major Lines Visibility Toggle - Using centralized Switch component */}
      <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.hover} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <div className="flex items-center justify-between">
          <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
            <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('rulerSettings.majorLines.display.title')}</div>
            <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('rulerSettings.majorLines.display.description')}</div>
          </div>
          <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
              {rulerSettings.horizontal.showMajorTicks ? t('rulerSettings.common.active') : t('rulerSettings.common.inactive')}
            </span>
            {/* 🏢 ADR-128: Status variant - Green ON / Red OFF */}
            <Switch
              checked={rulerSettings.horizontal.showMajorTicks}
              onCheckedChange={handleMajorTicksVisibilityChange}
              variant="status"
            />
          </div>
        </div>
      </div>

      {/* Major Lines Opacity */}
      <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.hover} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
          <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('rulerSettings.majorLines.opacity.title')}</div>
          <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('rulerSettings.majorLines.opacity.description')}</div>
        </div>
        <SliderInput
          value={getOpacityFromColor(rulerSettings.horizontal.majorTickColor)}
          min={0.1}
          max={1}
          step={0.1}
          onChange={handleMajorTickOpacityChange}
          showValue
          unit={SLIDER_VALUE_UNITS.percent01}
          tooltip={t('rulerSettings.majorLines.opacity.title')}
        />
      </div>

      {/* Major Lines Color */}
      <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.hover} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>{t('rulerSettings.majorLines.color.title')}</label>
        <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>{t('rulerSettings.majorLines.color.description')}</div>
        <ColorDialogTrigger
          value={getBaseColor(rulerSettings.horizontal.majorTickColor)}
          onChange={handleMajorTickColorChange}
          label={getBaseColor(rulerSettings.horizontal.majorTickColor)}
          title={t('rulerSettings.majorLines.colorPicker')}
          alpha={false}
          modes={['hex', 'rgb', 'hsl']}
          palettes={['dxf', 'semantic', 'material']}
          recent
          eyedropper
        />
      </div>

      {/* Major Lines Thickness — the slider works in PX (0.5..3); the stored
          `majorTickLength` is that px value ×10. The ÷10/×10 pair is a model
          SCALING, not a unit, so it stays put and `pixels` describes what the
          user actually sees and types. */}
      <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.hover} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
          <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('rulerSettings.majorLines.width.title')}</div>
          <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('rulerSettings.majorLines.width.description')}</div>
        </div>
        <SliderInput
          value={rulerSettings.horizontal.majorTickLength / 10}
          min={0.5}
          max={3}
          step={0.5}
          onChange={handleMajorTickThicknessChange}
          showValue
          unit={SLIDER_VALUE_UNITS.pixels}
          tooltip={t('rulerSettings.majorLines.width.title')}
        />
      </div>
    </div>
  );
};

export default RulerMajorLinesSettings;

/**
 * MIGRATION NOTES: Extracted from RulerLinesSettings.tsx lines 200-319
 * Original: Inline Major lines UI (120 lines) inside RulerLinesSettings
 *
 * Changes:
 * - ✅ Extracted Major lines UI to standalone component
 * - ✅ Preserved all handlers (visibility, color, opacity, thickness)
 * - ✅ Preserved helper functions (getPreviewColor, getPreviewBackground)
 * - ✅ Integrated useRulersGridContext hook
 * - ✅ No breaking changes to existing functionality
 *
 * Benefits:
 * - ✅ Single Responsibility (Major lines only)
 * - ✅ Enterprise file size (<200 lines) ✅
 * - ✅ Reusable component
 * - ✅ Testable in isolation
 * - ✅ Cleaner parent component (RulerLinesSettings → router only)
 */

