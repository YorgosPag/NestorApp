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
// 🏢 ENTERPRISE: Centralized Switch component (Radix)
import { Switch } from '@/components/ui/switch';

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
  const {
    state: { rulers: rulerSettings },
    updateRulerSettings
  } = useRulersGridContext();

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
    <div className={`space-y-4 ${className}`}>
      {/* Ruler Text Color */}
      <div className={`p-2 ${colors.bg.hover} ${radius.md} space-y-2`}>
        <div className="text-sm text-white">
          <div className="font-medium">Χρώμα Κειμένων</div>
          <div className={`font-normal ${colors.text.muted}`}>Χρώμα αριθμών και κειμένων χαράκων</div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`${iconSizes.lg} ${radius.md} ${getStatusBorder('default')}`}
            style={{ backgroundColor: rulerSettings.horizontal.textColor }}
          />
          <input
            type="color"
            value={rulerSettings.horizontal.textColor}
            onChange={(e) => handleRulerTextColorChange(e.target.value)}
            className={`${iconSizes.xl} ${radius.md} border-0 cursor-pointer w-8 h-6`}
          />
          <input
            type="text"
            value={rulerSettings.horizontal.textColor}
            onChange={(e) => handleRulerTextColorChange(e.target.value)}
            className={`px-2 py-1 text-xs ${colors.bg.muted} text-white ${radius.md} ${getStatusBorder('default')} w-20`}
            placeholder={UI_COLORS.WHITE}
          />
        </div>
      </div>

      {/* Font Size */}
      <div className={`p-2 ${colors.bg.hover} ${radius.md} space-y-2`}>
        <div className="text-sm text-white">
          <div className="font-medium">Μέγεθος Κειμένου</div>
          <div className={`font-normal ${colors.text.muted}`}>Μέγεθος των αριθμών στους χάρακες</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="8"
            max="25"
            step="1"
            value={rulerSettings.horizontal.fontSize}
            onChange={(e) => handleRulerFontSizeChange(parseInt(e.target.value))}
            className="flex-1"
          />
          <div className={`text-xs ${colors.bg.muted} text-white ${radius.md} px-2 py-1 text-center w-12`}>
            {rulerSettings.horizontal.fontSize}px
          </div>
        </div>
      </div>

      {/* 🏢 ENTERPRISE: Text Visibility Toggle - Using centralized Switch component */}
      <div className={`p-2 ${colors.bg.hover} ${radius.md} space-y-2`}>
        <div className="flex items-center justify-between">
          <div className="text-sm text-white">
            <div className="font-medium">Εμφάνιση Κειμένων</div>
            <div className={`font-normal ${colors.text.muted}`}>Εμφάνιση/απόκρυψη αριθμών και κειμένων στους χάρακες</div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${colors.text.muted}`}>
              {textVisible ? 'Ενεργό' : 'Ανενεργό'}
            </span>
            <Switch
              checked={textVisible}
              onCheckedChange={handleTextVisibilityChange}
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
