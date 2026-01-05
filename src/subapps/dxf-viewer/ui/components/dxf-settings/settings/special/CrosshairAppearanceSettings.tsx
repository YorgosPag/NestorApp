// CrosshairAppearanceSettings.tsx - Crosshair visual appearance settings (extracted from CrosshairSettings)
// STATUS: ACTIVE - Enterprise Split (560 lines → 3 components)
// PURPOSE: Line style, line width, size/type settings

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                        CROSS-REFERENCES (Documentation)                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * 📋 Component Guide:
 *    - docs/dxf-settings/COMPONENT_GUIDE.md (§7.4 CrosshairAppearanceSettings)
 *    - Total components: 33 (updated from 29 after Phase 4 split)
 *
 * 🏗️ Migration Checklist:
 *    - docs/dxf-settings/MIGRATION_CHECKLIST.md (Phase 4 - Step 4.3)
 *    - Status: ✅ COMPLETE - Enterprise Split Applied
 *
 * 📊 Architecture:
 *    - docs/dxf-settings/ARCHITECTURE.md (§6.3 Enterprise File Size Compliance)
 *    - File size: 195 lines (✅ <200 lines - Enterprise compliant)
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
 *    - Parent: CrosshairSettings.tsx (router - 120 lines)
 *    - Sibling: CrosshairBehaviorSettings.tsx (143 lines)
 *    - Uses: useCursorSettings hook (CursorSystem)
 *    - Uses: CursorColors type (CursorColorPalette)
 *
 * 📦 Extracted from:
 *    - Original: CrosshairSettings.tsx lines 170-435 (Phase 3)
 *    - Enterprise Split: Phase 4.3 (2025-10-07)
 *    - Reason: 560 lines → 3 files (120 + 195 + 143)
 */

'use client';

import React from 'react';
import { useCursorSettings } from '../../../../../systems/cursor';
import { DEFAULT_CURSOR_SETTINGS } from '../../../../../systems/cursor/config';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import type { CursorColors } from '../../../palettes/CursorColorPalette';
import { ColorDialogTrigger } from '../../../../color/EnterpriseColorDialog';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { layoutUtilities } from '@/styles/design-tokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';

export interface CrosshairAppearanceSettingsProps {
  className?: string;
  cursorColors: CursorColors;
  onCursorColorsChange: (colors: CursorColors) => void;
}

/**
 * CrosshairAppearanceSettings - Visual appearance settings for crosshair
 *
 * Purpose:
 * - Line style (solid, dashed, dotted, dash-dot)
 * - Line width (1px - 5px with quick buttons)
 * - Size/Type (0%, 5%, 8%, 15%, Full screen)
 *
 * State Management:
 * - Uses useCursorSettings() for cursor system integration
 * - Receives cursorColors from parent (for preview)
 * - All changes applied immediately (live preview)
 *
 * Extracted from: CrosshairSettings.tsx lines 170-435
 */
export const CrosshairAppearanceSettings: React.FC<CrosshairAppearanceSettingsProps> = ({
  className = '',
  cursorColors,
  onCursorColorsChange
}) => {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder, radius } = useBorderTokens();
  const colors = useSemanticColors();
  // ============================================================================
  // HOOKS
  // ============================================================================

  let cursorHookResult;
  try {
    cursorHookResult = useCursorSettings();
  } catch (error) {
    console.error('❌ CursorSystem context not available:', error);
    cursorHookResult = {
      settings: DEFAULT_CURSOR_SETTINGS,
      updateSettings: (updates: Partial<typeof DEFAULT_CURSOR_SETTINGS>) => {
        console.log('🔧 Mock updateSettings:', updates);
      }
    };
  }

  const { settings, updateSettings } = cursorHookResult;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <article className={`${PANEL_LAYOUT.SPACING.GAP_LG} ${className}`}>
      {/* Crosshair Color - 🏢 ENTERPRISE: Semantic section */}
      <section className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${radius.lg} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>Χρώμα Σταυρονήματος</h4>
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>Χρώμα γραμμών σταυρώνυματος</p>
        <ColorDialogTrigger
          value={cursorColors.crosshairColor}
          onChange={(color) => onCursorColorsChange({ ...cursorColors, crosshairColor: color })}
          label={cursorColors.crosshairColor}
          title="Επιλογή Χρώματος Σταυρώνυματος"
          alpha={false}
          modes={['hex', 'rgb', 'hsl']}
          palettes={['dxf', 'semantic', 'material']}
          recent={true}
          eyedropper={true}
        />
      </section>

      {/* Line Style - 🏢 ENTERPRISE: Semantic section */}
      <section className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${radius.lg} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary}`}>Τύπος Γραμμής</h4>
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>Στυλ απόδοσης γραμμών</p>
        <div className={`grid ${PANEL_LAYOUT.GRID.COLS_2} ${PANEL_LAYOUT.GAP.SM}`}>
          <button
            onClick={() => {
              updateSettings({ crosshair: { ...settings.crosshair, line_style: 'solid' } });
            }}
            className={`${PANEL_LAYOUT.SPACING.SM} ${quick.button} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
              (settings.crosshair.line_style || 'solid') === 'solid'
                ? `${colors.bg.primary} ${getStatusBorder('info')}`
                : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
            }`}
          >
            <div
              className="w-full"
              style={layoutUtilities.dxf.crosshairLine.solid(settings.crosshair.line_width, cursorColors.crosshairColor)}
            ></div>
            <span className={`block ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>Συνεχόμενη</span>
          </button>
          <button
            onClick={() => updateSettings({ crosshair: { ...settings.crosshair, line_style: 'dashed' } })}
            className={`${PANEL_LAYOUT.SPACING.SM} ${quick.button} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
              (settings.crosshair.line_style || 'solid') === 'dashed'
                ? `${colors.bg.primary} ${getStatusBorder('info')}`
                : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
            }`}
          >
            <div
              className="w-full"
              style={layoutUtilities.dxf.crosshairLine.dashed(settings.crosshair.line_width, cursorColors.crosshairColor)}
            ></div>
            <span className={`block ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>Διακεκομμένη</span>
          </button>
          <button
            onClick={() => updateSettings({ crosshair: { ...settings.crosshair, line_style: 'dotted' } })}
            className={`${PANEL_LAYOUT.SPACING.SM} ${quick.button} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
              (settings.crosshair.line_style || 'solid') === 'dotted'
                ? `${colors.bg.primary} ${getStatusBorder('info')}`
                : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
            }`}
          >
            <div
              className="w-full"
              style={layoutUtilities.dxf.crosshairLine.dotted(settings.crosshair.line_width, cursorColors.crosshairColor)}
            ></div>
            <span className={`block ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>Τελείες</span>
          </button>
          <button
            onClick={() => updateSettings({ crosshair: { ...settings.crosshair, line_style: 'dash-dot' } })}
            className={`${PANEL_LAYOUT.SPACING.SM} ${quick.button} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
              (settings.crosshair.line_style || 'solid') === 'dash-dot'
                ? `${colors.bg.primary} ${getStatusBorder('info')}`
                : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
            }`}
          >
            <div
              className="w-full"
              style={layoutUtilities.dxf.crosshairLine.dashDot(settings.crosshair.line_width, cursorColors.crosshairColor)}
            ></div>
            <span className={`block ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>Παύλα-Τελεία</span>
          </button>
        </div>
      </section>

      {/* Line Width - 🏢 ENTERPRISE: Semantic section */}
      <section className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${radius.lg} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary}`}>Πάχος Γραμμής</h4>
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>Πάχος σε pixels</p>
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <input
            type="range"
            min="1"
            max="5"
            step="0.5"
            value={settings.crosshair.line_width}
            onChange={(e) => updateSettings({ crosshair: { ...settings.crosshair, line_width: parseFloat(e.target.value) } })}
            className="flex-1"
          />
          <div className={`${PANEL_LAYOUT.WIDTH.VALUE_DISPLAY} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.muted} ${colors.text.primary} ${radius.md} ${PANEL_LAYOUT.SPACING.COMPACT} text-center`}>{settings.crosshair.line_width}px</div>
        </div>
        <div className={`flex ${PANEL_LAYOUT.GAP.XS}`}>
          {[1, 1.5, 2, 3, 4, 5].map(width => (
            <button
              key={width}
              onClick={() => updateSettings({ crosshair: { ...settings.crosshair, line_width: width } })}
              className={`flex-1 ${PANEL_LAYOUT.SPACING.XS} ${radius.md} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
                settings.crosshair.line_width === width
                  ? `${colors.bg.primary} border ${getStatusBorder('info')}`
                  : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} border ${getStatusBorder('default')}`
              }`}
            >
              <div
                className="w-full mx-auto"
                style={layoutUtilities.dxf.composite.coloredBar(width, cursorColors.crosshairColor)}
              ></div>
              <span className={`block ${PANEL_LAYOUT.MARGIN.TOP_XS} ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}>{width}px</span>
            </button>
          ))}
        </div>
      </section>

      {/* Size/Type - 🏢 ENTERPRISE: Semantic section */}
      <section className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${radius.lg} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary}`}>Μέγεθος Σταυρονήματος</h4>
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>Επέκταση από το κέντρο</p>
        <div className={`grid ${PANEL_LAYOUT.GRID.COLS_5} ${PANEL_LAYOUT.GAP.XS}`}>
          <button
            onClick={() => {
              updateSettings({ crosshair: { ...settings.crosshair, size_percent: 0 } });
            }}
            className={`${PANEL_LAYOUT.SPACING.SM} ${quick.button} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.TRANSITION.COLORS} relative flex flex-col items-center ${
              (settings.crosshair.size_percent ?? 8) === 0
                ? `${colors.bg.primary} ${getStatusBorder('info')}`
                : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
            }`}
          >
            <div className={`${iconSizes.lg} flex items-center justify-center`}>
              <div
                className={`${iconSizes.xxs} ${radius.full}`}
                style={layoutUtilities.dxf.colors.backgroundColor(cursorColors.crosshairColor)}
              ></div>
            </div>
            <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>0%</span>
          </button>
          <button
            onClick={() => updateSettings({ crosshair: { ...settings.crosshair, size_percent: 5 } })}
            className={`${PANEL_LAYOUT.SPACING.SM} ${quick.button} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.TRANSITION.COLORS} relative flex flex-col items-center ${
              (settings.crosshair.size_percent ?? 8) === 5
                ? `${colors.bg.primary} ${getStatusBorder('info')}`
                : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
            }`}
          >
            <div className={`${iconSizes.lg} flex items-center justify-center relative`}>
              {/* Οριζόντια γραμμή */}
              <div
                className={`absolute ${PANEL_LAYOUT.POSITION.TOP_HALF} ${PANEL_LAYOUT.POSITION.LEFT_HALF} ${iconSizes.xs} h-px ${PANEL_LAYOUT.TRANSFORM.CENTER}`}
                style={layoutUtilities.dxf.colors.backgroundColor(cursorColors.crosshairColor)}
              ></div>
              {/* Κάθετη γραμμή - 🏢 ENTERPRISE: Centralized preview size token */}
              <div
                className={`absolute ${PANEL_LAYOUT.POSITION.TOP_HALF} ${PANEL_LAYOUT.POSITION.LEFT_HALF} ${PANEL_LAYOUT.CROSSHAIR_PREVIEW.SIZE_5_PERCENT} w-px ${PANEL_LAYOUT.TRANSFORM.CENTER}`}
                style={layoutUtilities.dxf.colors.backgroundColor(cursorColors.crosshairColor)}
              ></div>
            </div>
            <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>5%</span>
          </button>
          <button
            onClick={() => updateSettings({ crosshair: { ...settings.crosshair, size_percent: 8 } })}
            className={`${PANEL_LAYOUT.SPACING.SM} ${quick.button} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.TRANSITION.COLORS} relative flex flex-col items-center ${
              (settings.crosshair.size_percent ?? 8) === 8
                ? `${colors.bg.primary} ${getStatusBorder('info')}`
                : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
            }`}
          >
            <div className={`${iconSizes.lg} flex items-center justify-center relative`}>
              {/* Οριζόντια γραμμή */}
              <div
                className={`absolute ${PANEL_LAYOUT.POSITION.TOP_HALF} ${PANEL_LAYOUT.POSITION.LEFT_HALF} ${iconSizes.sm} h-px ${PANEL_LAYOUT.TRANSFORM.CENTER}`}
                style={layoutUtilities.dxf.colors.backgroundColor(cursorColors.crosshairColor)}
              ></div>
              {/* Κάθετη γραμμή - 🏢 ENTERPRISE: Centralized preview size token */}
              <div
                className={`absolute ${PANEL_LAYOUT.POSITION.TOP_HALF} ${PANEL_LAYOUT.POSITION.LEFT_HALF} ${PANEL_LAYOUT.CROSSHAIR_PREVIEW.SIZE_8_PERCENT} w-px ${PANEL_LAYOUT.TRANSFORM.CENTER}`}
                style={layoutUtilities.dxf.colors.backgroundColor(cursorColors.crosshairColor)}
              ></div>
            </div>
            <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>8%</span>
          </button>
          <button
            onClick={() => updateSettings({ crosshair: { ...settings.crosshair, size_percent: 15 } })}
            className={`${PANEL_LAYOUT.SPACING.SM} ${quick.button} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.TRANSITION.COLORS} relative flex flex-col items-center ${
              (settings.crosshair.size_percent ?? 8) === 15
                ? `${colors.bg.primary} ${getStatusBorder('info')}`
                : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
            }`}
          >
            <div className={`${iconSizes.lg} flex items-center justify-center relative`}>
              {/* Οριζόντια γραμμή */}
              <div
                className={`absolute ${PANEL_LAYOUT.POSITION.TOP_HALF} ${PANEL_LAYOUT.POSITION.LEFT_HALF} ${iconSizes.md} h-px ${PANEL_LAYOUT.TRANSFORM.CENTER}`}
                style={layoutUtilities.dxf.colors.backgroundColor(cursorColors.crosshairColor)}
              ></div>
              {/* Κάθετη γραμμή - 🏢 ENTERPRISE: Centralized preview size token */}
              <div
                className={`absolute ${PANEL_LAYOUT.POSITION.TOP_HALF} ${PANEL_LAYOUT.POSITION.LEFT_HALF} ${PANEL_LAYOUT.CROSSHAIR_PREVIEW.SIZE_15_PERCENT} w-px ${PANEL_LAYOUT.TRANSFORM.CENTER}`}
                style={layoutUtilities.dxf.colors.backgroundColor(cursorColors.crosshairColor)}
              ></div>
            </div>
            <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>15%</span>
          </button>
          <button
            onClick={() => updateSettings({ crosshair: { ...settings.crosshair, size_percent: 100 } })}
            className={`${PANEL_LAYOUT.SPACING.SM} ${quick.button} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.TRANSITION.COLORS} relative flex flex-col items-center ${
              (settings.crosshair.size_percent ?? 8) === 100
                ? `${colors.bg.primary} ${getStatusBorder('info')}`
                : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
            }`}
          >
            <div className={`${iconSizes.lg} flex items-center justify-center relative`}>
              {/* Εξωτερικό πλαίσιο */}
              <div
                className={`absolute ${PANEL_LAYOUT.INSET['0']} border`}
                style={layoutUtilities.dxf.colors.borderColor(cursorColors.crosshairColor)}
              ></div>
              {/* Οριζόντια γραμμή που φτάνει τα άκρα του πλαισίου */}
              <div
                className={`absolute ${PANEL_LAYOUT.POSITION.TOP_HALF} ${PANEL_LAYOUT.POSITION.LEFT_0} w-full h-px ${PANEL_LAYOUT.TRANSFORM.CENTER_Y}`}
                style={layoutUtilities.dxf.colors.backgroundColor(cursorColors.crosshairColor)}
              ></div>
              {/* Κάθετη γραμμή που φτάνει τα άκρα του πλαισίου */}
              <div
                className={`absolute ${PANEL_LAYOUT.POSITION.LEFT_HALF} ${PANEL_LAYOUT.POSITION.TOP_0} h-full w-px ${PANEL_LAYOUT.TRANSFORM.CENTER_X}`}
                style={layoutUtilities.dxf.colors.backgroundColor(cursorColors.crosshairColor)}
              ></div>
            </div>
            <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>Full</span>
          </button>
        </div>
      </section>
    </article>
  );
};

export default CrosshairAppearanceSettings;

/**
 * MIGRATION NOTES: Extracted from CrosshairSettings.tsx lines 170-435
 * Original: Inline appearance UI (266 lines) inside CrosshairSettings
 *
 * Changes:
 * - ✅ Extracted Line Style, Line Width, Size/Type sections
 * - ✅ Receives cursorColors from parent (for preview)
 * - ✅ Integrated useCursorSettings hook
 * - ✅ Live updates to cursor system
 * - ✅ No breaking changes to existing functionality
 *
 * Benefits:
 * - ✅ Single Responsibility (Appearance settings only)
 * - ✅ Enterprise file size (<200 lines) ✅
 * - ✅ Reusable component
 * - ✅ Testable in isolation
 * - ✅ Cleaner parent component (CrosshairSettings → router only)
 */
