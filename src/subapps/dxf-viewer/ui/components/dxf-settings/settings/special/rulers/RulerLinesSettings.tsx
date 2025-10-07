// RulerLinesSettings.tsx - Ruler lines settings with Major/Minor sub-tabs (extracted from DxfSettingsPanel)
// STATUS: ACTIVE - Phase 3 Step 3.3b2
// PURPOSE: Ruler lines settings UI (visibility, color, opacity, thickness) with Major/Minor nested tabs

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  CROSS-REFERENCES: docs/dxf-settings/MIGRATION_CHECKLIST.md (STEP 3.3b2)  ║
 * ║  Parent: settings/special/RulersSettings.tsx (Lines tab)                   ║
 * ║  Uses: useRulersGridContext hook (RulersGridSystem)                        ║
 * ║  Hooks: useTabNavigation (Major/Minor lines sub-tabs)                      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

'use client';

import React from 'react';
import { useRulersGridContext } from '../../../../../../systems/rulers-grid/RulersGridSystem';
import { useTabNavigation } from '../../../hooks/useTabNavigation';
import { TabNavigation } from '../../../shared/TabNavigation';

export interface RulerLinesSettingsProps {
  className?: string;
}

/**
 * RulerLinesSettings - Ruler lines appearance settings (Major/Minor)
 *
 * Purpose:
 * - Major lines: Visibility, color, opacity, thickness
 * - Minor lines: Visibility, color, opacity, thickness
 * - Nested sub-tabs for Major/Minor separation
 *
 * State Management:
 * - Uses useRulersGridContext() hook for ruler system integration
 * - Uses useTabNavigation() for Major/Minor sub-tabs
 * - All changes applied immediately (live preview)
 *
 * Extracted from: DxfSettingsPanel.tsx lines 1642-1910
 */
export const RulerLinesSettings: React.FC<RulerLinesSettingsProps> = ({ className = '' }) => {
  // ============================================================================
  // HOOKS
  // ============================================================================

  const {
    state: { rulers: rulerSettings },
    updateRulerSettings
  } = useRulersGridContext();

  // Sub-tabs navigation (Major/Minor lines)
  type LinesTab = 'major' | 'minor';
  const { activeTab: activeLinesTab, setActiveTab: setActiveLinesTab } = useTabNavigation<LinesTab>('major');

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleMajorTicksVisibilityChange = (enabled: boolean) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, showMajorTicks: enabled },
      vertical: { ...rulerSettings.vertical, showMajorTicks: enabled }
    });
  };

  const handleMinorTicksVisibilityChange = (enabled: boolean) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, showMinorTicks: enabled },
      vertical: { ...rulerSettings.vertical, showMinorTicks: enabled }
    });
  };

  const handleMajorTickColorChange = (color: string) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, majorTickColor: color },
      vertical: { ...rulerSettings.vertical, majorTickColor: color }
    });
  };

  const handleMinorTickColorChange = (color: string) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, minorTickColor: color },
      vertical: { ...rulerSettings.vertical, minorTickColor: color }
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

  const handleMinorTickOpacityChange = (opacity: number) => {
    const minorTickColor = rulerSettings.horizontal.minorTickColor || '#ffffff';
    let r, g, b;

    if (minorTickColor.includes('rgba')) {
      const match = minorTickColor.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        r = parseInt(match[1]);
        g = parseInt(match[2]);
        b = parseInt(match[3]);
      } else {
        r = g = b = 255;
      }
    } else {
      const hex = minorTickColor.replace('#', '');
      r = parseInt(hex.substr(0, 2), 16);
      g = parseInt(hex.substr(2, 2), 16);
      b = parseInt(hex.substr(4, 2), 16);
    }

    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, minorTickColor: `rgba(${r}, ${g}, ${b}, ${opacity})` },
      vertical: { ...rulerSettings.vertical, minorTickColor: `rgba(${r}, ${g}, ${b}, ${opacity})` }
    });
  };

  const handleMajorTickThicknessChange = (thickness: number) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, majorTickLength: thickness * 10 },
      vertical: { ...rulerSettings.vertical, majorTickLength: thickness * 10 }
    });
  };

  const handleMinorTickThicknessChange = (thickness: number) => {
    updateRulerSettings({
      horizontal: { ...rulerSettings.horizontal, minorTickLength: thickness * 10 },
      vertical: { ...rulerSettings.vertical, minorTickLength: thickness * 10 }
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
  // TAB CONFIGURATION
  // ============================================================================

  const linesTabs = [
    { id: 'major' as const, label: '📏 Κύριες Γραμμές' },
    { id: 'minor' as const, label: '📐 Δευτερεύουσες Γραμμές' }
  ];

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Lines Sub-tabs */}
      <div className="flex gap-1 p-1 bg-gray-800 rounded">
        <TabNavigation
          tabs={linesTabs}
          activeTab={activeLinesTab}
          onTabChange={setActiveLinesTab}
        />
      </div>

      {/* Lines Content */}
      {activeLinesTab === 'major' ? (
        <div className="space-y-4">
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
      ) : (
        <div className="space-y-4">
          {/* Minor Lines Visibility Toggle */}
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <div className="text-sm text-white">
              <div className="font-medium">Εμφάνιση Δευτερευουσών Γραμμών</div>
              <div className="font-normal text-gray-400">Εμφάνιση/απόκρυψη των δευτερευουσών γραμμών χάρακα</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleMinorTicksVisibilityChange(true)}
                className={`flex-1 p-2 rounded text-xs border transition-colors ${
                  rulerSettings.horizontal.showMinorTicks
                    ? 'bg-blue-600 border-blue-500'
                    : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                }`}
              >
                Ενεργό
              </button>
              <button
                onClick={() => handleMinorTicksVisibilityChange(false)}
                className={`flex-1 p-2 rounded text-xs border transition-colors ${
                  !rulerSettings.horizontal.showMinorTicks
                    ? 'bg-blue-600 border-blue-500'
                    : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                }`}
              >
                Ανενεργό
              </button>
            </div>
          </div>

          {/* Minor Lines Opacity */}
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <div className="text-sm text-white">
              <div className="font-medium">Διαφάνεια Δευτερευουσών Γραμμών</div>
              <div className="font-normal text-gray-400">Επίπεδο διαφάνειας των δευτερευουσών γραμμών χάρακα</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={(() => {
                  const tickColor = rulerSettings.horizontal.minorTickColor;
                  if (tickColor.includes('rgba')) {
                    const match = tickColor.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
                    return match ? parseFloat(match[1]) : 1.0;
                  }
                  return 1.0;
                })()}
                onChange={(e) => handleMinorTickOpacityChange(parseFloat(e.target.value))}
                className="flex-1"
              />
              <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                {Math.round(((() => {
                  const tickColor = rulerSettings.horizontal.minorTickColor;
                  if (tickColor.includes('rgba')) {
                    const match = tickColor.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
                    return match ? parseFloat(match[1]) : 1.0;
                  }
                  return 1.0;
                })()) * 100)}%
              </div>
            </div>
          </div>

          {/* Minor Lines Color */}
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <div className="text-sm text-white">
              <div className="font-medium">Χρώμα Δευτερευουσών Γραμμών</div>
              <div className="font-normal text-gray-400">Χρώμα δευτερευουσών γραμμών (ticks) χαράκων</div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded border-2"
                style={{
                  backgroundColor: getPreviewBackground(rulerSettings.horizontal.minorTickColor),
                  borderColor: getPreviewColor(rulerSettings.horizontal.minorTickColor)
                }}
              />
              <input
                type="color"
                value={getPreviewColor(rulerSettings.horizontal.minorTickColor)}
                onChange={(e) => handleMinorTickColorChange(e.target.value)}
                className="w-8 h-6 rounded border-0 cursor-pointer"
              />
              <input
                type="text"
                value={rulerSettings.horizontal.minorTickColor}
                onChange={(e) => handleMinorTickColorChange(e.target.value)}
                className="w-20 px-2 py-1 text-xs bg-gray-600 text-white rounded border border-gray-500"
                placeholder="#ffffff"
              />
            </div>
          </div>

          {/* Minor Lines Thickness */}
          <div className="p-2 bg-gray-700 rounded space-y-2">
            <div className="text-sm text-white">
              <div className="font-medium">Πάχος Δευτερευουσών Γραμμών</div>
              <div className="font-normal text-gray-400">Πάχος των δευτερευουσών γραμμών του χάρακα</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.5"
                value={rulerSettings.horizontal.minorTickLength / 10}
                onChange={(e) => handleMinorTickThicknessChange(parseFloat(e.target.value))}
                className="flex-1"
              />
              <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                {rulerSettings.horizontal.minorTickLength / 10}px
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RulerLinesSettings;

/**
 * MIGRATION NOTES: Extracted from DxfSettingsPanel.tsx lines 1642-1910
 * Original: Inline UI in 'lines' tab of rulers category with nested Major/Minor tabs (269 lines)
 *
 * Changes:
 * - ✅ Extracted all ruler lines UI to standalone component
 * - ✅ Integrated useRulersGridContext hook
 * - ✅ Added useTabNavigation for Major/Minor sub-tabs
 * - ✅ Replaced inline nested tabs with TabNavigation component
 * - ✅ Helper functions for rgba color handling
 * - ✅ Live updates to ruler system
 * - ✅ No breaking changes to existing functionality
 *
 * Benefits:
 * - ✅ Single Responsibility (RulerLinesSettings = Lines UI only)
 * - ✅ Reusable component
 * - ✅ Testable in isolation
 * - ✅ Lazy loadable (performance)
 * - ✅ Cleaner parent component (RulersSettings)
 */
