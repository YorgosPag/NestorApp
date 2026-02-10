// CrosshairBehaviorSettings.tsx - Crosshair behavior settings (extracted from CrosshairSettings)
// STATUS: ACTIVE - Enterprise Split (560 lines → 3 components)
// PURPOSE: Color, opacity, cursor gap settings

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                        CROSS-REFERENCES (Documentation)                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * 📋 Component Guide:
 *    - docs/dxf-settings/COMPONENT_GUIDE.md (§7.5 CrosshairBehaviorSettings)
 *    - Total components: 33 (updated from 29 after Phase 4 split)
 *
 * 🏗️ Migration Checklist:
 *    - docs/dxf-settings/MIGRATION_CHECKLIST.md (Phase 4 - Step 4.3)
 *    - Status: ✅ COMPLETE - Enterprise Split Applied
 *
 * 📊 Architecture:
 *    - docs/dxf-settings/ARCHITECTURE.md (§6.3 Enterprise File Size Compliance)
 *    - File size: 143 lines (✅ <200 lines - Enterprise compliant)
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
 *    - Sibling: CrosshairAppearanceSettings.tsx (195 lines)
 *    - Uses: useCursorSettings hook (CursorSystem)
 *    - Uses: CursorColors type (CursorColorPalette)
 *
 * 📦 Extracted from:
 *    - Original: CrosshairSettings.tsx lines 144-168, 437-487 (Phase 3)
 *    - Enterprise Split: Phase 4.3 (2025-10-07)
 *    - Reason: 560 lines → 3 files (120 + 195 + 143)
 */

'use client';

import React from 'react';
import { useCursorSettings } from '../../../../../systems/cursor';
import { DEFAULT_CURSOR_SETTINGS } from '../../../../../systems/cursor/config';
import type { CursorColors } from '../../../palettes/CursorColorPalette';
import { ColorDialogTrigger } from '../../../../color/EnterpriseColorDialog';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized Switch component (Radix)
import { Switch } from '@/components/ui/switch';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n';

export interface CrosshairBehaviorSettingsProps {
  className?: string;
  cursorColors: CursorColors;
  onCursorColorsChange: (colors: CursorColors) => void;
}

/**
 * CrosshairBehaviorSettings - Behavior and color settings for crosshair
 *
 * Purpose:
 * - Crosshair color picker
 * - Opacity slider (0.1 - 1.0)
 * - Cursor gap toggle (enable/disable)
 *
 * State Management:
 * - Uses useCursorSettings() for cursor system integration
 * - Receives cursorColors and onChange from parent
 * - All changes applied immediately (live preview)
 *
 * Extracted from: CrosshairSettings.tsx lines 144-168, 437-487
 */
export const CrosshairBehaviorSettings: React.FC<CrosshairBehaviorSettingsProps> = ({
  className = '',
  cursorColors,
  onCursorColorsChange
}) => {
  // ============================================================================
  // HOOKS
  // ============================================================================

  const colors = useSemanticColors();
  // 🌐 i18n
  const { t } = useTranslation('dxf-viewer');
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
    <div className={`${PANEL_LAYOUT.SPACING.GAP_LG} ${className}`}>
      {/* Crosshair Color */}
      <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>{t('crosshairSettings.behavior.colorTitle')}</label>
        <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>{t('crosshairSettings.behavior.colorDescription')}</div>
        <ColorDialogTrigger
          value={cursorColors.crosshairColor}
          onChange={(color) => onCursorColorsChange({ ...cursorColors, crosshairColor: color })}
          label={cursorColors.crosshairColor}
          title={t('crosshairSettings.colorPicker')}
          alpha={false}
          modes={['hex', 'rgb', 'hsl']}
          palettes={['dxf', 'semantic', 'material']}
          recent
          eyedropper
        />
      </div>

      {/* Crosshair Opacity */}
      <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
          <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('crosshairSettings.behavior.opacityTitle')}</div>
          <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('crosshairSettings.behavior.opacityDescription')}</div>
        </div>
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={settings.crosshair.opacity || 0.9}
            onChange={(e) => updateSettings({ crosshair: { ...settings.crosshair, opacity: parseFloat(e.target.value) } })}
            className="flex-1"
          />
          <div className={`${PANEL_LAYOUT.WIDTH.VALUE_DISPLAY} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.muted} ${colors.text.primary} rounded ${PANEL_LAYOUT.SPACING.XS} text-center`}>
            {Math.round((settings.crosshair.opacity || 0.9) * 100)}%
          </div>
        </div>
      </div>

      {/* 🏢 ENTERPRISE: Cursor Gap Toggle - Using centralized Switch component */}
      <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} rounded ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <div className="flex items-center justify-between">
          <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
            <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('crosshairSettings.behavior.cursorGapTitle')}</div>
            <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('crosshairSettings.behavior.cursorGapDescription')}</div>
          </div>
          <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
              {settings.crosshair.use_cursor_gap ? t('crosshairSettings.common.active') : t('crosshairSettings.common.inactive')}
            </span>
            <Switch
              checked={settings.crosshair.use_cursor_gap}
              onCheckedChange={(checked) => updateSettings({ crosshair: { ...settings.crosshair, use_cursor_gap: checked } })}
              variant="status"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrosshairBehaviorSettings;

/**
 * MIGRATION NOTES: Extracted from CrosshairSettings.tsx lines 144-168, 437-487
 * Original: Inline color/opacity/gap UI (75 lines) inside CrosshairSettings
 *
 * Changes:
 * - ✅ Extracted Color, Opacity, Cursor Gap sections
 * - ✅ Receives cursorColors and onChange from parent
 * - ✅ Integrated useCursorSettings hook
 * - ✅ Live updates to cursor system
 * - ✅ No breaking changes to existing functionality
 *
 * Benefits:
 * - ✅ Single Responsibility (Behavior settings only)
 * - ✅ Enterprise file size (<200 lines) ✅
 * - ✅ Reusable component
 * - ✅ Testable in isolation
 * - ✅ Cleaner parent component (CrosshairSettings → router only)
 */

