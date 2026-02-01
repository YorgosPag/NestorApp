// RulerTextSettings.tsx - Ruler text settings (extracted from DxfSettingsPanel)
// STATUS: ACTIVE - Phase 3 Step 3.3b3
// PURPOSE: Ruler text settings UI (color, font size, visibility)

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  CROSS-REFERENCES: docs/dxf-settings/MIGRATION_CHECKLIST.md (STEP 3.3b3)  ║
 * ║  Parent: settings/special/RulersSettings.tsx (Text tab)                    ║
 * ║  Uses: useRulersGridContext hook (RulersGridSystem)                        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useRulersGridContext } from '../../../../../../systems/rulers-grid/RulersGridSystem';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { UI_COLORS } from '../../../../../../config/color-config';
import { PANEL_LAYOUT } from '../../../../../../config/panel-tokens';
// 🏢 ENTERPRISE: Centralized Switch component (Radix)
import { Switch } from '@/components/ui/switch';
// 🏢 ENTERPRISE: Dynamic background class (ZERO inline styles)
import { useDynamicBackgroundClass } from '@/components/ui/utils/dynamic-styles';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';

export interface RulerTextSettingsProps {
  className?: string;
}

/**
 * RulerTextSettings - Ruler text appearance settings
 *
 * Purpose:
 * - Text color control
 * - Font size control
 * - Text visibility toggle
 *
 * State Management:
 * - Uses useRulersGridContext() hook for ruler system integration
 * - Local textVisible state synced with ruler settings
 * - All changes applied immediately (live preview)
 *
 * Extracted from: DxfSettingsPanel.tsx lines 1911-1991
 */
export const RulerTextSettings: React.FC<RulerTextSettingsProps> = ({ className = '' }) => {
  // ============================================================================
  // HOOKS
  // ============================================================================

  const iconSizes = useIconSizes();
  const { quick, getStatusBorder, radius } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('dxf-viewer');
  const {
    state: { rulers: rulerSettings },
    updateRulerSettings
  } = useRulersGridContext();

  // 🏢 ENTERPRISE: Dynamic background class (ZERO inline styles)
  const textColorBgClass = useDynamicBackgroundClass(rulerSettings?.horizontal?.textColor ?? UI_COLORS.WHITE);

  // ============================================================================
  // LOCAL STATE
  // ============================================================================

  const [textVisible, setTextVisible] = useState<boolean>(
    rulerSettings?.horizontal?.showLabels ?? true
  );

  // Sync local state with ruler settings
  useEffect(() => {
    setTextVisible(rulerSettings?.horizontal?.showLabels ?? true);
  }, [rulerSettings]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleRulerTextColorChange = (color: string) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, textColor: color },
      vertical: { ...rulerSettings.vertical, textColor: color }
    });
  };

  const handleRulerFontSizeChange = (size: number) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, fontSize: size },
      vertical: { ...rulerSettings.vertical, fontSize: size }
    });
  };

  const handleTextVisibilityChange = (visible: boolean) => {
    setTextVisible(visible);
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, showLabels: visible },
      vertical: { ...rulerSettings.vertical, showLabels: visible }
    });
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`${PANEL_LAYOUT.SPACING.GAP_LG} ${className}`}>
      {/* Ruler Text Color */}
      <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.hover} ${radius.md} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
          <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('rulerSettings.text.colorTitle')}</div>
          <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('rulerSettings.text.colorDescription')}</div>
        </div>
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <div
            className={`${iconSizes.lg} ${radius.md} ${getStatusBorder('default')} ${textColorBgClass}`}
          />
          <input
            type="color"
            value={rulerSettings.horizontal.textColor}
            onChange={(e) => handleRulerTextColorChange(e.target.value)}
            className={`${iconSizes.xl} ${radius.md} border-0 ${PANEL_LAYOUT.CURSOR.POINTER} ${PANEL_LAYOUT.WIDTH.SM} ${PANEL_LAYOUT.HEIGHT.LG}`}
          />
          <input
            type="text"
            value={rulerSettings.horizontal.textColor}
            onChange={(e) => handleRulerTextColorChange(e.target.value)}
            className={`${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.muted} ${colors.text.primary} ${radius.md} ${getStatusBorder('default')} ${PANEL_LAYOUT.WIDTH.INPUT_SM}`}
            placeholder={UI_COLORS.WHITE}
          />
        </div>
      </div>

      {/* Font Size */}
      <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.hover} ${radius.md} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
          <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('rulerSettings.text.sizeTitle')}</div>
          <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('rulerSettings.text.sizeDescription')}</div>
        </div>
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <input
            type="range"
            min="8"
            max="25"
            step="1"
            value={rulerSettings.horizontal.fontSize}
            onChange={(e) => handleRulerFontSizeChange(parseInt(e.target.value))}
            className="flex-1"
          />
          <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.muted} ${colors.text.primary} ${radius.md} ${PANEL_LAYOUT.SPACING.COMPACT} text-center ${PANEL_LAYOUT.WIDTH.VALUE_DISPLAY}`}>
            {rulerSettings.horizontal.fontSize}px
          </div>
        </div>
      </div>

      {/* 🏢 ENTERPRISE: Text Visibility Toggle - Using centralized Switch component */}
      <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.hover} ${radius.md} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
        <div className="flex items-center justify-between">
          <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
            <div className={PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}>{t('rulerSettings.text.displayTitle')}</div>
            <div className={`${PANEL_LAYOUT.FONT_WEIGHT.NORMAL} ${colors.text.muted}`}>{t('rulerSettings.text.displayDescription')}</div>
          </div>
          <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
              {textVisible ? t('rulerSettings.common.active') : t('rulerSettings.common.inactive')}
            </span>
            {/* 🏢 ADR-128: Status variant - Green ON / Red OFF */}
            <Switch
              checked={textVisible}
              onCheckedChange={handleTextVisibilityChange}
              variant="status"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RulerTextSettings;

/**
 * MIGRATION NOTES: Extracted from DxfSettingsPanel.tsx lines 1911-1991
 * Original: Inline UI in 'text' tab of rulers category (81 lines)
 *
 * Changes:
 * - ✅ Extracted all ruler text UI to standalone component
 * - ✅ Integrated useRulersGridContext hook
 * - ✅ Local textVisible state with sync logic
 * - ✅ Live updates to ruler system
 * - ✅ No breaking changes to existing functionality
 *
 * Benefits:
 * - ✅ Single Responsibility (RulerTextSettings = Text UI only)
 * - ✅ Reusable component
 * - ✅ Testable in isolation
 * - ✅ Lazy loadable (performance)
 * - ✅ Cleaner parent component (RulersSettings)
 */
