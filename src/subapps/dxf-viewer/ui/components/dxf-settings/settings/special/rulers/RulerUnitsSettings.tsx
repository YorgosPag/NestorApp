'use client';

// RulerUnitsSettings.tsx - Ruler units settings (extracted from DxfSettingsPanel)
// STATUS: ACTIVE - Phase 3 Step 3.3b4
// PURPOSE: Ruler units settings UI (units type, visibility, font size, color)

import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { UI_COLORS } from '../../../../../../config/color-config';
// 🏢 ENTERPRISE: Centralized Switch component (Radix)
import { Switch } from '@/components/ui/switch';
// 🏢 ENTERPRISE: Dynamic background/border classes (ZERO inline styles)
import { useDynamicBackgroundClass, useDynamicBorderClass } from '@/components/ui/utils/dynamic-styles';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../../../../config/panel-tokens';

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

  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  const {
    state: { rulers: rulerSettings },
    updateRulerSettings
  } = useRulersGridContext();

  // 🏢 ENTERPRISE: Compute preview color for units (ZERO inline styles)
  const unitsPreviewColor = rulerSettings?.horizontal?.unitsColor ||
    rulerSettings?.horizontal?.textColor ||
    UI_COLORS.WHITE;
  const unitsBgClass = useDynamicBackgroundClass(unitsPreviewColor);
  const unitsBorderClass = useDynamicBorderClass(unitsPreviewColor);

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
  const getPreviewColor = (color: string): string => {
    if (color.includes('rgba')) {
      const match = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const r = parseInt(match[1]).toString(16).padStart(2, '0');
        const g = parseInt(match[2]).toString(16).padStart(2, '0');
        const b = parseInt(match[3]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
    }
    return color;
  };

  // Helper function to get preview background for divs (preserves rgba)
  const getPreviewBackground = (color: string): string => {
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
          <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>Μονάδες Μέτρησης</div>
          <div className={`font-normal ${colors.text.muted}`}>Μονάδα μέτρησης στους χάρακες</div>
        </div>
        <div className={`grid grid-cols-3 ${PANEL_LAYOUT.GAP.SM}`}>
          {(['mm', 'cm', 'm'] as const).map((unit) => (
            <button
              key={unit}
              onClick={() => handleRulerUnitsChange(unit)}
              className={`${PANEL_LAYOUT.SPACING.SM} rounded ${PANEL_LAYOUT.TYPOGRAPHY.XS} border transition-colors ${
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
            <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>Εμφάνιση Μονάδων</div>
            <div className={`font-normal ${colors.text.muted}`}>Εμφάνιση/απόκρυψη μονάδων μέτρησης στους χάρακες</div>
          </div>
          <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
              {unitsVisible ? 'Ενεργό' : 'Ανενεργό'}
            </span>
            <Switch
              checked={unitsVisible}
              onCheckedChange={handleUnitsVisibilityChange}
            />
          </div>
        </div>
      </div>

      {/* Units Font Size */}
      <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.hover} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
          <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>Μέγεθος Μονάδων</div>
          <div className={`font-normal ${colors.text.muted}`}>Μέγεθος των μονάδων μέτρησης στους χάρακες</div>
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
          <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>Χρώμα Μονάδων</div>
          <div className={`font-normal ${colors.text.muted}`}>Χρώμα των μονάδων μέτρησης στους χάρακες</div>
        </div>
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <div
            className={`${iconSizes.lg} rounded ${unitsBgClass} ${unitsBorderClass}`}
          />
          <input
            type="color"
            value={getPreviewColor(
              rulerSettings.horizontal.unitsColor ||
              rulerSettings.horizontal.textColor ||
              UI_COLORS.WHITE
            )}
            onChange={(e) => handleUnitsColorChange(e.target.value)}
            className={`${iconSizes.xl} h-6 rounded border-0 cursor-pointer`}
          />
          <input
            type="text"
            value={
              rulerSettings.horizontal.unitsColor ||
              rulerSettings.horizontal.textColor ||
              UI_COLORS.WHITE
            }
            onChange={(e) => handleUnitsColorChange(e.target.value)}
            className={`w-20 ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.muted} ${colors.text.primary} rounded ${getStatusBorder('muted')}`}
            placeholder={UI_COLORS.WHITE}
          />
        </div>
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
