'use client';

// RulerBackgroundSettings.tsx - Ruler background settings (extracted from DxfSettingsPanel)
// STATUS: ACTIVE - Phase 3 Step 3.3b1
// PURPOSE: Ruler background settings UI (color, opacity, width, visibility)

import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';

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
  const [rulerBackgroundColor, setRulerBackgroundColor] = useState<string>('#ffffff');

  // Sync local state with ruler settings
  useEffect(() => {
    setBackgroundVisible(rulerSettings?.horizontal?.showBackground ?? true);

    // Extract color from backgroundColor (може να είναι rgba)
    const bgColor = rulerSettings.horizontal.backgroundColor;
    if (bgColor.includes('rgba')) {
      // Extract hex from rgba
      const match = bgColor.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const r = parseInt(match[1]).toString(16).padStart(2, '0');
        const g = parseInt(match[2]).toString(16).padStart(2, '0');
        const b = parseInt(match[3]).toString(16).padStart(2, '0');
        setRulerBackgroundColor(`#${r}${g}${b}`);
      }
    } else {
      setRulerBackgroundColor(bgColor);
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

    // Convert hex to rgb
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity})` },
      vertical: { ...rulerSettings.vertical, backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity})` }
    });
  };

  const handleRulerOpacityChange = (opacity: number) => {
    // Διατηρούμε το τρέχον χρώμα και αλλάζουμε μόνο την opacity
    const hex = rulerBackgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity})` },
      vertical: { ...rulerSettings.vertical, backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity})` }
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
    <div className={`space-y-4 ${className}`}>
      {/* Background Visibility Toggle */}
      <div className="p-2 bg-gray-700 rounded space-y-2">
        <div className="text-sm text-white">
          <div className="font-medium">Εμφάνιση Φόντου</div>
          <div className="font-normal text-gray-400">Εμφάνιση/απόκρυψη του φόντου των χαράκων</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleBackgroundVisibilityChange(true)}
            className={`flex-1 p-2 rounded text-xs border transition-colors ${
              backgroundVisible
                ? 'bg-blue-600 border-blue-500'
                : `bg-gray-600 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} border-gray-500`
            }`}
          >
            Ενεργό
          </button>
          <button
            onClick={() => handleBackgroundVisibilityChange(false)}
            className={`flex-1 p-2 rounded text-xs border transition-colors ${
              !backgroundVisible
                ? 'bg-blue-600 border-blue-500'
                : `bg-gray-600 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} border-gray-500`
            }`}
          >
            Ανενεργό
          </button>
        </div>
      </div>

      {/* Ruler Background Color */}
      <div className="p-2 bg-gray-700 rounded space-y-2">
        <div className="text-sm text-white">
          <div className="font-medium">Χρώμα Φόντου</div>
          <div className="font-normal text-gray-400">Χρώμα φόντου του χάρακα</div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded border border-gray-500"
            style={{ backgroundColor: rulerBackgroundColor }}
          />
          <input
            type="color"
            value={rulerBackgroundColor}
            onChange={(e) => handleRulerBackgroundColorChange(e.target.value)}
            className="w-8 h-6 rounded border-0 cursor-pointer"
          />
          <input
            type="text"
            value={rulerBackgroundColor}
            onChange={(e) => handleRulerBackgroundColorChange(e.target.value)}
            className="w-20 px-2 py-1 text-xs bg-gray-600 text-white rounded border border-gray-500"
            placeholder="#ffffff"
          />
        </div>
      </div>

      {/* Ruler Opacity */}
      <div className="p-2 bg-gray-700 rounded space-y-2">
        <div className="text-sm text-white">
          <div className="font-medium">Διαφάνεια</div>
          <div className="font-normal text-gray-400">Επίπεδο διαφάνειας των χαράκων</div>
        </div>
        <div className="flex items-center gap-2">
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
          <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
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
      <div className="p-2 bg-gray-700 rounded space-y-2">
        <div className="text-sm text-white">
          <div className="font-medium">Πλάτος Χάρακα</div>
          <div className="font-normal text-gray-400">Πλάτος του χάρακα σε pixels</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="20"
            max="60"
            step="5"
            value={rulerSettings.horizontal.height}
            onChange={(e) => handleRulerWidthChange(parseInt(e.target.value))}
            className="flex-1"
          />
          <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
            {rulerSettings.horizontal.height}px
          </div>
        </div>
      </div>

      {/* Ruler Lines Visibility Toggle */}
      <div className="p-2 bg-gray-700 rounded space-y-2">
        <div className="text-sm text-white">
          <div className="font-medium">Εμφάνιση Γραμμών</div>
          <div className="font-normal text-gray-400">Εμφάνιση/απόκρυψη γραμμών μέτρησης στους χάρακες</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleRulerUnitsEnabledChange(true)}
            className={`flex-1 p-2 rounded text-xs border transition-colors ${
              rulerSettings.horizontal.showMinorTicks
                ? 'bg-blue-600 border-blue-500'
                : `bg-gray-600 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} border-gray-500`
            }`}
          >
            Ενεργό
          </button>
          <button
            onClick={() => handleRulerUnitsEnabledChange(false)}
            className={`flex-1 p-2 rounded text-xs border transition-colors ${
              !rulerSettings.horizontal.showMinorTicks
                ? 'bg-blue-600 border-blue-500'
                : `bg-gray-600 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} border-gray-500`
            }`}
          >
            Ανενεργό
          </button>
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
