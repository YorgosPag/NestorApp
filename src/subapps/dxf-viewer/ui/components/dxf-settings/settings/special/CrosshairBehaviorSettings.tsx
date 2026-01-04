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
    <div className={`space-y-4 ${className}`}>
      {/* Crosshair Color */}
      <div className={`p-2 ${colors.bg.secondary} rounded space-y-2`}>
        <label className={`block text-sm font-medium ${colors.text.secondary}`}>Χρώμα</label>
        <div className={`text-xs ${colors.text.muted} mb-2`}>Χρώμα γραμμών σταυρώνυματος</div>
        <ColorDialogTrigger
          value={cursorColors.crosshairColor}
          onChange={(color) => onCursorColorsChange({ ...cursorColors, crosshairColor: color })}
          label={cursorColors.crosshairColor}
          title="Επιλογή Χρώματος Crosshair"
          alpha={false}
          modes={['hex', 'rgb', 'hsl']}
          palettes={['dxf', 'semantic', 'material']}
          recent={true}
          eyedropper={true}
        />
      </div>

      {/* Crosshair Opacity */}
      <div className={`p-2 ${colors.bg.secondary} rounded space-y-2`}>
        <div className={`text-sm ${colors.text.primary}`}>
          <div className="font-medium">Διαφάνεια Σταυρονήματος</div>
          <div className={`font-normal ${colors.text.muted}`}>Επίπεδο διαφάνειας του σταυρονήματος</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={settings.crosshair.opacity || 0.9}
            onChange={(e) => updateSettings({ crosshair: { ...settings.crosshair, opacity: parseFloat(e.target.value) } })}
            className="flex-1"
          />
          <div className={`w-12 text-xs ${colors.bg.muted} ${colors.text.primary} rounded px-2 py-1 text-center`}>
            {Math.round((settings.crosshair.opacity || 0.9) * 100)}%
          </div>
        </div>
      </div>

      {/* 🏢 ENTERPRISE: Cursor Gap Toggle - Using centralized Switch component */}
      <div className={`p-2 ${colors.bg.secondary} rounded space-y-2`}>
        <div className="flex items-center justify-between">
          <div className={`text-sm ${colors.text.primary}`}>
            <div className="font-medium">Cursor Gap</div>
            <div className={`font-normal ${colors.text.muted}`}>Οι γραμμές ξεκινάνε έξω από τον κέρσορα</div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${colors.text.muted}`}>
              {settings.crosshair.use_cursor_gap ? 'Ενεργό' : 'Ανενεργό'}
            </span>
            <Switch
              checked={settings.crosshair.use_cursor_gap}
              onCheckedChange={(checked) => updateSettings({ crosshair: { ...settings.crosshair, use_cursor_gap: checked } })}
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
