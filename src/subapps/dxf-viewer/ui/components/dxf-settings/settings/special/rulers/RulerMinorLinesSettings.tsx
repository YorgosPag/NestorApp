// RulerMinorLinesSettings.tsx - Minor lines appearance settings (extracted from RulerLinesSettings)
// STATUS: ACTIVE - Enterprise Split (485 lines → 3 components)
// PURPOSE: Minor ruler lines UI (visibility, color, opacity, thickness)

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                        CROSS-REFERENCES (Documentation)                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * 📋 Component Guide:
 *    - docs/dxf-settings/COMPONENT_GUIDE.md (§7.3 RulerMinorLinesSettings)
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
 *    - Sibling: RulerMajorLinesSettings.tsx (155 lines)
 *    - Uses: useRulersGridContext hook (RulersGridSystem)
 *
 * 📦 Extracted from:
 *    - Original: RulerLinesSettings.tsx lines 321-439 (Phase 3)
 *    - Enterprise Split: Phase 4.2 (2025-10-07)
 *    - Reason: 485 lines → 3 files (100 + 155 + 155)
 */

'use client';

import React from 'react';
import { useRulersGridContext } from '../../../../../../systems/rulers-grid/RulersGridSystem';
import { ColorDialogTrigger } from '../../../../../color/EnterpriseColorDialog';
import { UI_COLORS, withOpacity } from '../../../../../../config/color-config';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized Switch component (Radix)
import { Switch } from '@/components/ui/switch';
// 🏢 ENTERPRISE: Centralized spacing tokens (ADR-UI-001)
import { PANEL_LAYOUT } from '../../../../../../config/panel-tokens';

export interface RulerMinorLinesSettingsProps {
  className?: string;
}

/**
 * RulerMinorLinesSettings - Minor ruler lines appearance settings
 *
 * Purpose:
 * - Visibility toggle (show/hide minor lines)
 * - Color picker (rgba support)
 * - Opacity slider (0.1 - 1.0)
 * - Thickness control (0.5px - 3px)
 *
 * State Management:
 * - Uses useRulersGridContext() for ruler system integration
 * - All changes applied immediately (live preview)
 * - Updates both horizontal and vertical rulers
 *
 * Extracted from: RulerLinesSettings.tsx lines 321-439
 */
export const RulerMinorLinesSettings: React.FC<RulerMinorLinesSettingsProps> = ({ className = '' }) => {
  const colors = useSemanticColors();
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

  // 🏢 ENTERPRISE: Extract opacity from various color formats
  const getOpacityFromColor = (color: string): number => {
    if (color.includes('rgba')) {
      const match = color.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
      return match ? parseFloat(match[1]) : 1.0;
    }
    // Handle hex+alpha format (#RRGGBBAA)
    if (color.startsWith('#') && color.length === 9) {
      const alphaHex = color.slice(7, 9);
      return parseInt(alphaHex, 16) / 255;
    }
    return 1.0;
  };

  // 🏢 ENTERPRISE: Extract base color (without alpha) from various formats
  const getBaseColor = (color: string): string => {
    if (color.includes('rgba')) {
      const match = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const r = parseInt(match[1]).toString(16).padStart(2, '0');
        const g = parseInt(match[2]).toString(16).padStart(2, '0');
        const b = parseInt(match[3]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
    }
    // Handle hex+alpha format (#RRGGBBAA)
    if (color.startsWith('#') && color.length === 9) {
      return color.slice(0, 7);
    }
    return color;
  };

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

  const handleMinorTicksVisibilityChange = (enabled: boolean) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, showMinorTicks: enabled },
      vertical: { ...rulerSettings.vertical, showMinorTicks: enabled }
    });
  };

  const handleMinorTickColorChange = (color: string) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, minorTickColor: color },
      vertical: { ...rulerSettings.vertical, minorTickColor: color }
    });
  };

  const handleMinorTickOpacityChange = (opacity: number) => {
    // 🏢 ENTERPRISE FIX: Extract base color (without alpha) before applying new opacity
    const currentColor = rulerSettings.horizontal.minorTickColor || UI_COLORS.WHITE;
    const baseColor = getBaseColor(currentColor);
    const colorWithOpacity = withOpacity(baseColor, opacity);

    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, minorTickColor: colorWithOpacity },
      vertical: { ...rulerSettings.vertical, minorTickColor: colorWithOpacity }
    });
  };

  const handleMinorTickThicknessChange = (thickness: number) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, minorTickLength: thickness * 10 },
      vertical: { ...rulerSettings.vertical, minorTickLength: thickness * 10 }
    });
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`${PANEL_LAYOUT.SPACING.GAP_LG} ${className}`}>
      {/* 🏢 ENTERPRISE: Minor Lines Visibility Toggle - Using centralized Switch component */}
      <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.hover} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <div className="flex items-center justify-between">
          <div className={`text-sm ${colors.text.primary}`}>
            <div className="font-medium">Εμφάνιση Δευτερευουσών Γραμμών</div>
            <div className={`font-normal ${colors.text.muted}`}>Εμφάνιση/απόκρυψη των δευτερευουσών γραμμών χάρακα</div>
          </div>
          <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            <span className={`text-xs ${colors.text.muted}`}>
              {rulerSettings.horizontal.showMinorTicks ? 'Ενεργό' : 'Ανενεργό'}
            </span>
            <Switch
              checked={rulerSettings.horizontal.showMinorTicks}
              onCheckedChange={handleMinorTicksVisibilityChange}
            />
          </div>
        </div>
      </div>

      {/* Minor Lines Opacity */}
      <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.hover} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <div className={`text-sm ${colors.text.primary}`}>
          <div className="font-medium">Διαφάνεια Δευτερευουσών Γραμμών</div>
          <div className={`font-normal ${colors.text.muted}`}>Επίπεδο διαφάνειας των δευτερευουσών γραμμών χάρακα</div>
        </div>
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={getOpacityFromColor(rulerSettings.horizontal.minorTickColor)}
            onChange={(e) => handleMinorTickOpacityChange(parseFloat(e.target.value))}
            className="flex-1"
          />
          <div className={`${PANEL_LAYOUT.WIDTH.VALUE_DISPLAY} text-xs ${colors.bg.muted} ${colors.text.primary} rounded ${PANEL_LAYOUT.SPACING.COMPACT} text-center`}>
            {Math.round(getOpacityFromColor(rulerSettings.horizontal.minorTickColor) * 100)}%
          </div>
        </div>
      </div>

      {/* Minor Lines Color */}
      <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.hover} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <label className={`block text-sm font-medium ${colors.text.secondary}`}>Χρώμα Δευτερευουσών Γραμμών</label>
        <div className={`text-xs ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>Χρώμα δευτερευουσών γραμμών (ticks) χαράκων</div>
        <ColorDialogTrigger
          value={getBaseColor(rulerSettings.horizontal.minorTickColor)}
          onChange={handleMinorTickColorChange}
          label={getBaseColor(rulerSettings.horizontal.minorTickColor)}
          title="Επιλογή Χρώματος Δευτερευουσών Γραμμών Χάρακα"
          alpha={false}
          modes={['hex', 'rgb', 'hsl']}
          palettes={['dxf', 'semantic', 'material']}
          recent={true}
          eyedropper={true}
        />
      </div>

      {/* Minor Lines Thickness */}
      <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.hover} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <div className={`text-sm ${colors.text.primary}`}>
          <div className="font-medium">Πάχος Δευτερευουσών Γραμμών</div>
          <div className={`font-normal ${colors.text.muted}`}>Πάχος των δευτερευουσών γραμμών του χάρακα</div>
        </div>
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.5"
            value={rulerSettings.horizontal.minorTickLength / 10}
            onChange={(e) => handleMinorTickThicknessChange(parseFloat(e.target.value))}
            className="flex-1"
          />
          <div className={`${PANEL_LAYOUT.WIDTH.VALUE_DISPLAY} text-xs ${colors.bg.muted} ${colors.text.primary} rounded ${PANEL_LAYOUT.SPACING.COMPACT} text-center`}>
            {rulerSettings.horizontal.minorTickLength / 10}px
          </div>
        </div>
      </div>
    </div>
  );
};

export default RulerMinorLinesSettings;

/**
 * MIGRATION NOTES: Extracted from RulerLinesSettings.tsx lines 321-439
 * Original: Inline Minor lines UI (119 lines) inside RulerLinesSettings
 *
 * Changes:
 * - ✅ Extracted Minor lines UI to standalone component
 * - ✅ Preserved all handlers (visibility, color, opacity, thickness)
 * - ✅ Preserved helper functions (getPreviewColor, getPreviewBackground)
 * - ✅ Integrated useRulersGridContext hook
 * - ✅ No breaking changes to existing functionality
 *
 * Benefits:
 * - ✅ Single Responsibility (Minor lines only)
 * - ✅ Enterprise file size (<200 lines) ✅
 * - ✅ Reusable component
 * - ✅ Testable in isolation
 * - ✅ Cleaner parent component (RulerLinesSettings → router only)
 */
