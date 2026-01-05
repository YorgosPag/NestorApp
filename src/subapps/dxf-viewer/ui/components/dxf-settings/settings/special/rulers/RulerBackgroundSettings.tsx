'use client';

// RulerBackgroundSettings.tsx - Ruler background settings (extracted from DxfSettingsPanel)
// STATUS: ACTIVE - Phase 3 Step 3.3b1
// PURPOSE: Ruler background settings UI (color, opacity, width, visibility)

import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { UI_COLORS, withOpacity } from '../../../../../../config/color-config';
// 🏢 ENTERPRISE: Centralized Color Picker (same as GridSettings, CrosshairSettings, etc.)
import { ColorDialogTrigger } from '../../../../../color/EnterpriseColorDialog';
// 🏢 ENTERPRISE: Centralized Switch component (Radix)
import { Switch } from '@/components/ui/switch';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../../../../config/panel-tokens';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  CROSS-REFERENCES: docs/dxf-settings/MIGRATION_CHECKLIST.md (STEP 3.3b1)  ║
 * ║  Parent: settings/special/RulersSettings.tsx (Background tab)              ║
 * ║  Uses: useRulersGridContext hook (RulersGridSystem)                        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect } from 'react';
import { useRulersGridContext } from '../../../../../../systems/rulers-grid/RulersGridSystem';

export interface RulerBackgroundSettingsProps {
  className?: string;
}

/**
 * RulerBackgroundSettings - Ruler background appearance settings
 *
 * Purpose:
 * - Background visibility toggle
 * - Background color picker
 * - Ruler opacity control
 * - Ruler width (thickness) control
 * - Lines visibility toggle
 *
 * State Management:
 * - Uses useRulersGridContext() hook for ruler system integration
 * - Local state for background color (synced with ruler settings)
 * - All changes applied immediately (live preview)
 *
 * Extracted from: DxfSettingsPanel.tsx lines 1495-1641
 */
export const RulerBackgroundSettings: React.FC<RulerBackgroundSettingsProps> = ({ className = '' }) => {
  // ============================================================================
  // HOOKS
  // ============================================================================
  const colors = useSemanticColors();

  const {
    state: { rulers: rulerSettings },
    updateRulerSettings
  } = useRulersGridContext();

  // ============================================================================
  // LOCAL STATE
  // ============================================================================

  // Background visibility state
  const [backgroundVisible, setBackgroundVisible] = useState<boolean>(
    rulerSettings?.horizontal?.showBackground ?? true
  );

  // Ruler background color state (για εύκολο syncing με color picker)
  const [rulerBackgroundColor, setRulerBackgroundColor] = useState<string>(UI_COLORS.WHITE);

  // Sync local state with ruler settings
  useEffect(() => {
    setBackgroundVisible(rulerSettings?.horizontal?.showBackground ?? true);

    // Extract color from backgroundColor
    const bgColor = rulerSettings.horizontal.backgroundColor;

    // 🏢 ENTERPRISE: Handle different color formats
    if (bgColor.includes('var(') || bgColor.includes('hsl(var')) {
      // CSS variable format - use default white
      setRulerBackgroundColor(UI_COLORS.WHITE);
    } else if (bgColor.includes('rgba')) {
      // Extract hex from rgba
      const match = bgColor.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const r = parseInt(match[1]).toString(16).padStart(2, '0');
        const g = parseInt(match[2]).toString(16).padStart(2, '0');
        const b = parseInt(match[3]).toString(16).padStart(2, '0');
        setRulerBackgroundColor(`#${r}${g}${b}`);
      } else {
        setRulerBackgroundColor(UI_COLORS.WHITE);
      }
    } else if (bgColor.startsWith('#')) {
      // 🏢 ENTERPRISE FIX: Handle hex colors with or without alpha
      // #RGB (4), #RRGGBB (7), #RRGGBBAA (9)
      if (bgColor.length === 9) {
        // Hex with alpha - extract RGB part only
        setRulerBackgroundColor(bgColor.slice(0, 7));
      } else if (bgColor.length === 7 || bgColor.length === 4) {
        // Valid hex color without alpha
        setRulerBackgroundColor(bgColor);
      } else {
        setRulerBackgroundColor(UI_COLORS.WHITE);
      }
    } else {
      // Unknown format - use default
      setRulerBackgroundColor(UI_COLORS.WHITE);
    }
  }, [rulerSettings]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleBackgroundVisibilityChange = (visible: boolean) => {
    setBackgroundVisible(visible);
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, showBackground: visible },
      vertical: { ...rulerSettings.vertical, showBackground: visible }
    });
  };

  const handleRulerBackgroundColorChange = (color: string) => {
    setRulerBackgroundColor(color);

    // Get current opacity
    const bgColor = rulerSettings.horizontal.backgroundColor;
    let opacity = 0.8;
    if (bgColor.includes('rgba')) {
      const match = bgColor.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
      if (match) opacity = parseFloat(match[1]);
    }

    // Use centralized withOpacity function instead of manual rgba construction
    const colorWithOpacity = withOpacity(color, opacity);

    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, backgroundColor: colorWithOpacity },
      vertical: { ...rulerSettings.vertical, backgroundColor: colorWithOpacity }
    });
  };

  const handleRulerOpacityChange = (opacity: number) => {
    // Use centralized withOpacity function instead of manual rgba construction
    const colorWithOpacity = withOpacity(rulerBackgroundColor, opacity);

    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, backgroundColor: colorWithOpacity },
      vertical: { ...rulerSettings.vertical, backgroundColor: colorWithOpacity }
    });
  };

  const handleRulerWidthChange = (width: number) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, height: width },
      vertical: { ...rulerSettings.vertical, width: width }
    });
  };

  const handleRulerUnitsEnabledChange = (enabled: boolean) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, showMinorTicks: enabled },
      vertical: { ...rulerSettings.vertical, showMinorTicks: enabled }
    });
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`${PANEL_LAYOUT.SPACING.GAP_LG} ${className}`}>
      {/* 🏢 ENTERPRISE: Background Visibility Toggle - Using centralized Switch component */}
      <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <div className="flex items-center justify-between">
          <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
            <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>Εμφάνιση Φόντου</div>
            <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>Εμφάνιση/απόκρυψη του φόντου των χαράκων</div>
          </div>
          <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
              {backgroundVisible ? 'Ενεργό' : 'Ανενεργό'}
            </span>
            <Switch
              checked={backgroundVisible}
              onCheckedChange={handleBackgroundVisibilityChange}
            />
          </div>
        </div>
      </div>

      {/* Ruler Background Color - 🏢 ENTERPRISE: Using centralized ColorDialogTrigger */}
      <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
          <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>Χρώμα Φόντου</div>
          <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>Χρώμα φόντου του χάρακα</div>
        </div>
        <ColorDialogTrigger
          value={rulerBackgroundColor}
          onChange={handleRulerBackgroundColorChange}
          label={rulerBackgroundColor}
          title="Επιλογή Χρώματος Φόντου Χάρακα"
          alpha={false}
          modes={['hex', 'rgb', 'hsl']}
          palettes={['dxf', 'semantic', 'material']}
          recent={true}
          eyedropper={true}
        />
      </div>

      {/* Ruler Opacity */}
      <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
          <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>Διαφάνεια</div>
          <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>Επίπεδο διαφάνειας των χαράκων</div>
        </div>
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={(() => {
              const bgColor = rulerSettings.horizontal.backgroundColor;
              if (bgColor.includes('rgba')) {
                const match = bgColor.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
                return match ? parseFloat(match[1]) : 0.8;
              }
              return 0.8;
            })()}
            onChange={(e) => handleRulerOpacityChange(parseFloat(e.target.value))}
            className="flex-1"
          />
          <div className={`${PANEL_LAYOUT.WIDTH.VALUE_DISPLAY} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.muted} ${colors.text.primary} rounded ${PANEL_LAYOUT.SPACING.XS} text-center`}>
            {Math.round(((() => {
              const bgColor = rulerSettings.horizontal.backgroundColor;
              if (bgColor.includes('rgba')) {
                const match = bgColor.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
                return match ? parseFloat(match[1]) : 0.8;
              }
              return 0.8;
            })()) * 100)}%
          </div>
        </div>
      </div>

      {/* Ruler Width */}
      <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
          <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>Πλάτος Χάρακα</div>
          <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>Πλάτος του χάρακα σε pixels</div>
        </div>
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <input
            type="range"
            min="20"
            max="60"
            step="5"
            value={rulerSettings.horizontal.height}
            onChange={(e) => handleRulerWidthChange(parseInt(e.target.value))}
            className="flex-1"
          />
          <div className={`${PANEL_LAYOUT.WIDTH.VALUE_DISPLAY} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.muted} ${colors.text.primary} rounded ${PANEL_LAYOUT.SPACING.XS} text-center`}>
            {rulerSettings.horizontal.height}px
          </div>
        </div>
      </div>

      {/* 🏢 ENTERPRISE: Ruler Lines Visibility Toggle - Using centralized Switch component */}
      <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <div className="flex items-center justify-between">
          <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
            <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>Εμφάνιση Γραμμών</div>
            <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>Εμφάνιση/απόκρυψη γραμμών μέτρησης στους χάρακες</div>
          </div>
          <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
              {rulerSettings.horizontal.showMinorTicks ? 'Ενεργό' : 'Ανενεργό'}
            </span>
            <Switch
              checked={rulerSettings.horizontal.showMinorTicks}
              onCheckedChange={handleRulerUnitsEnabledChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RulerBackgroundSettings;

/**
 * MIGRATION NOTES: Extracted from DxfSettingsPanel.tsx lines 1495-1641
 * Original: Inline UI in 'background' tab of rulers category (147 lines)
 *
 * Changes:
 * - ✅ Extracted all ruler background UI to standalone component
 * - ✅ Integrated useRulersGridContext hook
 * - ✅ Local state for background color with sync logic
 * - ✅ Live updates to ruler system
 * - ✅ No breaking changes to existing functionality
 *
 * Benefits:
 * - ✅ Single Responsibility (RulerBackgroundSettings = Background UI only)
 * - ✅ Reusable component
 * - ✅ Testable in isolation
 * - ✅ Lazy loadable (performance)
 * - ✅ Cleaner parent component (RulersSettings)
 */
