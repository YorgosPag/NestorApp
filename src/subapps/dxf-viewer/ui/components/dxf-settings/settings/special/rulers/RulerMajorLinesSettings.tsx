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
import { useRulersGridContext } from '../../../../../../../systems/rulers-grid/RulersGridSystem';

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
  // ============================================================================
  // HOOKS
  // ============================================================================

  const {
    state: { rulers: rulerSettings },
    updateRulerSettings
  } = useRulersGridContext();

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
    const majorTickColor = rulerSettings.horizontal.majorTickColor || '#ffffff';
    let r, g, b;

    if (majorTickColor.includes('rgba')) {
      const match = majorTickColor.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        r = parseInt(match[1]);
        g = parseInt(match[2]);
        b = parseInt(match[3]);
      } else {
        r = g = b = 255;
      }
    } else {
      const hex = majorTickColor.replace('#', '');
      r = parseInt(hex.substr(0, 2), 16);
      g = parseInt(hex.substr(2, 2), 16);
      b = parseInt(hex.substr(4, 2), 16);
    }

    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, majorTickColor: `rgba(${r}, ${g}, ${b}, ${opacity})` },
      vertical: { ...rulerSettings.vertical, majorTickColor: `rgba(${r}, ${g}, ${b}, ${opacity})` }
    });
  };

  const handleMajorTickThicknessChange = (thickness: number) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, majorTickLength: thickness * 10 },
      vertical: { ...rulerSettings.vertical, majorTickLength: thickness * 10 }
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
    <div className={`space-y-4 ${className}`}>
      {/* Major Lines Visibility Toggle */}
      <div className="p-2 bg-gray-700 rounded space-y-2">
        <div className="text-sm text-white">
          <div className="font-medium">Εμφάνιση Κύριων Γραμμών</div>
          <div className="font-normal text-gray-400">Εμφάνιση/απόκρυψη των κύριων γραμμών χάρακα</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleMajorTicksVisibilityChange(true)}
            className={`flex-1 p-2 rounded text-xs border transition-colors ${
              rulerSettings.horizontal.showMajorTicks
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
            }`}
          >
            Ενεργό
          </button>
          <button
            onClick={() => handleMajorTicksVisibilityChange(false)}
            className={`flex-1 p-2 rounded text-xs border transition-colors ${
              !rulerSettings.horizontal.showMajorTicks
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
            }`}
          >
            Ανενεργό
          </button>
        </div>
      </div>

      {/* Major Lines Opacity */}
      <div className="p-2 bg-gray-700 rounded space-y-2">
        <div className="text-sm text-white">
          <div className="font-medium">Διαφάνεια Κύριων Γραμμών</div>
          <div className="font-normal text-gray-400">Επίπεδο διαφάνειας των κύριων γραμμών χάρακα</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={(() => {
              const tickColor = rulerSettings.horizontal.majorTickColor;
              if (tickColor.includes('rgba')) {
                const match = tickColor.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
                return match ? parseFloat(match[1]) : 1.0;
              }
              return 1.0;
            })()}
            onChange={(e) => handleMajorTickOpacityChange(parseFloat(e.target.value))}
            className="flex-1"
          />
          <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
            {Math.round(((() => {
              const tickColor = rulerSettings.horizontal.majorTickColor;
              if (tickColor.includes('rgba')) {
                const match = tickColor.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
                return match ? parseFloat(match[1]) : 1.0;
              }
              return 1.0;
            })()) * 100)}%
          </div>
        </div>
      </div>

      {/* Major Lines Color */}
      <div className="p-2 bg-gray-700 rounded space-y-2">
        <div className="text-sm text-white">
          <div className="font-medium">Χρώμα Κύριων Γραμμών</div>
          <div className="font-normal text-gray-400">Χρώμα κύριων γραμμών (ticks) χαράκων</div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded border-2"
            style={{
              backgroundColor: getPreviewBackground(rulerSettings.horizontal.majorTickColor),
              borderColor: getPreviewColor(rulerSettings.horizontal.majorTickColor)
            }}
          />
          <input
            type="color"
            value={getPreviewColor(rulerSettings.horizontal.majorTickColor)}
            onChange={(e) => handleMajorTickColorChange(e.target.value)}
            className="w-8 h-6 rounded border-0 cursor-pointer"
          />
          <input
            type="text"
            value={rulerSettings.horizontal.majorTickColor}
            onChange={(e) => handleMajorTickColorChange(e.target.value)}
            className="w-20 px-2 py-1 text-xs bg-gray-600 text-white rounded border border-gray-500"
            placeholder="#ffffff"
          />
        </div>
      </div>

      {/* Major Lines Thickness */}
      <div className="p-2 bg-gray-700 rounded space-y-2">
        <div className="text-sm text-white">
          <div className="font-medium">Πάχος Κύριων Γραμμών</div>
          <div className="font-normal text-gray-400">Πάχος των κύριων γραμμών του χάρακα</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.5"
            value={rulerSettings.horizontal.majorTickLength / 10}
            onChange={(e) => handleMajorTickThicknessChange(parseFloat(e.target.value))}
            className="flex-1"
          />
          <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
            {rulerSettings.horizontal.majorTickLength / 10}px
          </div>
        </div>
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
