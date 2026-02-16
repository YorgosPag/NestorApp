'use client';

// RulerUnitsSettings.tsx - Ruler units settings (extracted from DxfSettingsPanel)
// STATUS: ACTIVE - Phase 3 Step 3.3b4
// PURPOSE: Ruler units settings UI (units type, visibility, font size, color)

import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { UI_COLORS } from '../../../../../../config/color-config';
import { ColorDialogTrigger } from '../../../../../color/EnterpriseColorDialog';
// 🏢 ADR-076: Centralized Color Conversion
import { rgbToHex } from '../../../../../color/utils';
// 🏢 ENTERPRISE: Centralized Switch component (Radix)
import { Switch } from '@/components/ui/switch';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../../../../config/panel-tokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  CROSS-REFERENCES: docs/dxf-settings/MIGRATION_CHECKLIST.md (STEP 3.3b4)  ║
 * ║  Parent: settings/special/RulersSettings.tsx (Units tab)                   ║
 * ║  Uses: useRulersGridContext hook (RulersGridSystem)                        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect } from 'react';
import { useRulersGridContext } from '../../../../../../systems/rulers-grid/RulersGridSystem';

export interface RulerUnitsSettingsProps {
  className?: string;
}

/**
 * RulerUnitsSettings - Ruler units appearance settings
 *
 * Purpose:
 * - Units type selection (mm, cm, m)
 * - Units visibility toggle
 * - Units font size control
 * - Units color control
 *
 * State Management:
 * - Uses useRulersGridContext() hook for ruler system integration
 * - Local unitsVisible state synced with ruler settings
 * - All changes applied immediately (live preview)
 *
 * Extracted from: DxfSettingsPanel.tsx lines 1992-2098
 */
export const RulerUnitsSettings: React.FC<RulerUnitsSettingsProps> = ({ className = '' }) => {
  // ============================================================================
  // HOOKS
  // ============================================================================

  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('dxf-viewer');

  const {
    state: { rulers: rulerSettings },
    updateRulerSettings
  } = useRulersGridContext();


  // ============================================================================
  // LOCAL STATE
  // ============================================================================

  const [unitsVisible, setUnitsVisible] = useState<boolean>(
    rulerSettings?.horizontal?.showUnits ?? true
  );

  // Sync local state with ruler settings
  useEffect(() => {
    setUnitsVisible(rulerSettings?.horizontal?.showUnits ?? true);
  }, [rulerSettings]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleRulerUnitsChange = (units: 'mm' | 'cm' | 'm') => {
    updateRulerSettings({ units });
  };

  const handleUnitsVisibilityChange = (visible: boolean) => {
    setUnitsVisible(visible);
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, showUnits: visible },
      vertical: { ...rulerSettings.vertical, showUnits: visible }
    });
  };

  const handleRulerUnitsFontSizeChange = (size: number) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, unitsFontSize: size },
      vertical: { ...rulerSettings.vertical, unitsFontSize: size }
    });
  };

  const handleUnitsColorChange = (color: string) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, unitsColor: color },
      vertical: { ...rulerSettings.vertical, unitsColor: color }
    });
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  // Helper function to get color for preview icon (handles rgba)
  // 🏢 ADR-076: Uses centralized color conversion
  const getPreviewColor = (color: string): string => {
    if (color.includes('rgba')) {
      const match = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        return rgbToHex({ r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) });
      }
    }
    return color;
  };


  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`${PANEL_LAYOUT.SPACING.GAP_LG} ${className}`}>
      {/* Ruler Units */}
      <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.hover} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
          <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('rulerSettings.units.measurementTitle')}</div>
          <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('rulerSettings.units.measurementDescription')}</div>
        </div>
        <div className={`grid ${PANEL_LAYOUT.GRID.COLS_3} ${PANEL_LAYOUT.GAP.SM}`}>
          {(['mm', 'cm', 'm'] as const).map((unit) => (
            <button
              key={unit}
              onClick={() => handleRulerUnitsChange(unit)}
              className={`${PANEL_LAYOUT.SPACING.SM} rounded ${PANEL_LAYOUT.TYPOGRAPHY.XS} border ${PANEL_LAYOUT.TRANSITION.COLORS} ${
                rulerSettings.units === unit
                  ? `${colors.bg.info} ${getStatusBorder('info')}`
                  : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('muted')}`
              }`}
            >
              {unit}
            </button>
          ))}
        </div>
      </div>

      {/* 🏢 ENTERPRISE: Units Visibility Toggle - Using centralized Switch component */}
      <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.hover} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <div className="flex items-center justify-between">
          <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
            <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('rulerSettings.units.displayTitle')}</div>
            <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('rulerSettings.units.displayDescription')}</div>
          </div>
          <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
              {unitsVisible ? t('rulerSettings.common.active') : t('rulerSettings.common.inactive')}
            </span>
            {/* 🏢 ADR-128: Status variant - Green ON / Red OFF */}
            <Switch
              checked={unitsVisible}
              onCheckedChange={handleUnitsVisibilityChange}
              variant="status"
            />
          </div>
        </div>
      </div>

      {/* Units Font Size */}
      <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.hover} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
          <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('rulerSettings.units.sizeTitle')}</div>
          <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('rulerSettings.units.sizeDescription')}</div>
        </div>
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <input
            type="range"
            min="8"
            max="25"
            step="1"
            value={rulerSettings.horizontal.unitsFontSize || 10}
            onChange={(e) => handleRulerUnitsFontSizeChange(parseInt(e.target.value))}
            className="flex-1"
          />
          <div className={`${PANEL_LAYOUT.WIDTH.VALUE_DISPLAY} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.muted} ${colors.text.primary} rounded ${PANEL_LAYOUT.SPACING.COMPACT} text-center`}>
            {rulerSettings.horizontal.unitsFontSize || 10}px
          </div>
        </div>
      </div>

      {/* Units Color */}
      <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.hover} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
          <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('rulerSettings.units.colorTitle')}</div>
          <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('rulerSettings.units.colorDescription')}</div>
        </div>
        <ColorDialogTrigger
          value={getPreviewColor(
            rulerSettings.horizontal.unitsColor ||
            rulerSettings.horizontal.textColor ||
            UI_COLORS.WHITE
          )}
          onChange={handleUnitsColorChange}
          label={
            rulerSettings.horizontal.unitsColor ||
            rulerSettings.horizontal.textColor ||
            UI_COLORS.WHITE
          }
          title={t('rulerSettings.units.colorTitle')}
          alpha={false}
          modes={['hex', 'rgb', 'hsl']}
          palettes={['dxf', 'semantic', 'material']}
          recent
          eyedropper
        />
      </div>
    </div>
  );
};

export default RulerUnitsSettings;

/**
 * MIGRATION NOTES: Extracted from DxfSettingsPanel.tsx lines 1992-2098
 * Original: Inline UI in 'units' tab of rulers category (107 lines)
 *
 * Changes:
 * - ✅ Extracted all ruler units UI to standalone component
 * - ✅ Integrated useRulersGridContext hook
 * - ✅ Local unitsVisible state with sync logic
 * - ✅ Helper functions for rgba color handling
 * - ✅ Live updates to ruler system
 * - ✅ No breaking changes to existing functionality
 *
 * Benefits:
 * - ✅ Single Responsibility (RulerUnitsSettings = Units UI only)
 * - ✅ Reusable component
 * - ✅ Testable in isolation
 * - ✅ Lazy loadable (performance)
 * - ✅ Cleaner parent component (RulersSettings)
 */

